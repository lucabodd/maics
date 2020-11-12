//Web server
var express = require('express');
var app = express();
var router = express.Router();

//Configurations
const config = require('../../etc/config.json');

//MongoDB
var DB = require("../../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//LDAP
var LDAP = require("../../modules/ldap");
var ldap = new LDAP(config.ldap);

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"
const journal_log = config.maics.log_dir+"journal.log"

//RSA
var AES_256_CFB = require("../../modules/aes-256-cfb");
var aes_256_cfb = new AES_256_CFB();

//crypt SHA-512
var crypto = require('crypto');

//Base 32 decode otp secret
const base32Decode = require('base32-decode')

//Time format
var ZT = require("../../modules/ztime");
var ztime = new ZT();

//Authenticator
var speakeasy = require("speakeasy");

//UFA
const u2f = require("u2f");

/**************************************
 *  Contain routes for user management*
 *  (See nav bar under item "User")   *
 **************************************/


/***************************************
 *          USER MANAGEMENT            *
 ***************************************/



router.get('/verify-otp', function (req, res, next) {
        var otp = req.query.otp;
        mdb.connect(mongo_instance)
        .then(
            function(value){
                mdb.findDocument("users", {email: req.session.email}, {sys_username: 1, email: 1, otp_secret: 1, key_last_unlock: 1, sshPublicKey:1})
                    .then(
                        function(user){
                            var verified = speakeasy.totp.verify({
                              secret: user.otp_secret,
                              encoding: 'base32',
                              window: 5,
                              token: otp
                            });
                            if(verified){
                                if(!req.session.otp_verified){
                                    req.session.otp_verified = true;
                                    var hash = crypto.createHash('sha512');
                                    var plain_otp_secret = Buffer.from(base32Decode(user.otp_secret, 'RFC4648'), 'HEX').toString();
                                    data = hash.update(plain_otp_secret+req.session.master_key, 'utf-8');
                                    gen_hash= data.digest('hex');
                                    req.session.otp_secret_hash = gen_hash;
                                }
                                res.redirect("/home/keys?error=false");
                            }
                            else {
                                res.redirect("/home/keys?error=true&code=\'SK010\'");
                            }
                        },
                        function(err){
                            log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        }
                    );
            },
            function(err){
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
            }
        );
});

router.post('/verify-token', function (req, res, next) {
    mdb.connect(mongo_instance)
    .then(
        function(){
            mdb.findDocument("users", {email: req.session.email})
            .then(
                function(user){
                    success = u2f.checkSignature(req.session.u2f, JSON.parse(req.body.loginResponse), user.token_publicKey);
                    if(success.successful){
                        if(!req.session.token_verified){
                            req.session.token_verified = true;
                            var hash = crypto.createHash('sha512');
                            data = hash.update(user.token_publicKey+req.session.master_key, 'utf-8');
                            gen_hash= data.digest('hex');
                            req.session.token_secret_hash = gen_hash;
                        }
                        res.redirect("/home/keys?error=false");
                    }
                    else{
                        res.redirect("/home/keys?error=true&code=\'SK010\'");
                    }
                },
                function(err){
                    log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                }
            )
        },
        function(err){
            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
        }
    );
});


router.post('/key-unlock', function (req, res, next) {
    //test
    var hash = crypto.createHash('sha512');
    data = hash.update(req.session.otp_secret_hash+req.session.token_secret_hash, 'utf-8');
    gen_hash= data.digest('hex');
    console.log("OTP hash: "+req.session.otp_secret_hash)
    console.log("TKN hash: "+req.session.token_secret_hash)
    console.log("HASHSUM: "+gen_hash)

    mdb.connect(mongo_instance)
    .then(
        function(){
            mdb.findDocument("users", {email: req.session.email})
            .then(
                function(user){
                    if(user.otp_enabled==req.session.otp_verified && user.token_enabled==req.session.token_verified){
                        req.session.key_lock=false;
                        mdb.updDocument("users", {email: req.session.email}, {$set: { key_last_unlock: ztime.current() }})
                            .then(
                                function(){
                                    diffHours = ztime.hoursDiff(user.key_last_unlock); //user from first find
                                    if(diffHours<9)
                                    {
                                        log("[+] User "+req.session.email+" successfully unlocked his SSH key", app_log);
                                        log("[+] User "+req.session.email+" successfully unlocked his SSH key. request occurred from "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                        res.redirect("/home/keys?error=false");
                                    }
                                    else{
                                        log("[+] MAICS is decripting "+req.session.email+" key", app_log);
                                        //user first unlock
                                        if(user.sshPublicKey == "")
                                        {
                                            log("[+] User "+req.session.email+" successfully unlocked his SSH key", app_log);
                                            res.redirect("/home/keys?error=false");
                                        }
                                        else if(user.sshPublicKey.indexOf("ssh-rsa") == -1)
                                        {
                                            var hash = crypto.createHash('sha512');
                                            data = hash.update(req.session.otp_secret_hash+req.session.token_secret_hash, 'utf-8');
                                            gen_hash= data.digest('hex');
                                            console.log("OTP hash:"+req.session.otp_secret_hash)
                                            console.log("TKN hash:"+req.session.token_secret_hash)
                                            console.log("HASHSUM: "+gen_hash)

                                            const decKey = aes_256_cfb.AESdecrypt(gen_hash, user.sshPublicKey);
                                            mdb.updDocument("users", {sys_username: user.sys_username}, { $set: { sshPublicKey: decKey }})
                                                .then(
                                                        function(){
                                                            ldap.modKey(user.sys_username, decKey)
                                                                .then(
                                                                    function(succ){
                                                                        log("[+] SKDC successfully decrypted "+req.session.email+" key", app_log);
                                                                        log("[+] User "+user.email+" public key unlocked in specified timestamp by OTP authentication", journal_log);
                                                                        res.redirect("/home/keys?error=false");
                                                                    },
                                                                    function(err){
                                                                        log('[-] Connection to LDAP has been established, but no query can be performed, reason: '+err.message, app_log);
                                                                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                                                                    }
                                                                )
                                                        },
                                                        function(err){
                                                            log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                                                        }
                                                );
                                        }
                                        else{
                                            log("[+] MAICS key of "+req.session.email+" already decrypted, last unlock time: "+user.key_last_unlock+" no decryption needed.", app_log);
                                            res.redirect("/home/keys?error=false");
                                        }
                                    }
                                },
                                function(err){
                                    log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                                }
                            );
                    }
                    else{
                        res.redirect("/home/keys?error=true&code=\'SK010\'");
                    }
                },
                function(err){
                    log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                }
            );
        },
        function(err){
            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
        }
    );
});
                                /*




                                            //if less than 9 means 1 decryption has already been performed, no decryption needed

                                            else{


                                            }
                                        },
                                        function(err){
                                            log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                                        }
                                    );
                            }
                            else{
                                log("[*] User "+user.sys_username+" failed to unlock ssh public ket, reason: wrong OTP key",app_log);
                                res.redirect("/home/keys?error=true&code=\'SK010\'");
                            }
                        },
                        function(err){
                            log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        }
                    );
            }, function(err){
                log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
            }
        );
});*/

router.get('/key-enroll-otp-secret', function (req, res, next) {
        var secret = req.query.otp_secret;
        mdb.connect(mongo_instance)
            .then(
                    function(){
                        mdb.updDocument("users", {email: req.session.email}, { $set: {otp_secret: secret }})
                            .then(
                                function () {
                                    log("[+] User "+req.session.email+" successfully saved OTP secret.", app_log);
                                    log("[+] User "+req.session.email+" successfully saved OTP secret at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                    res.redirect('/home/2fa?error=false');
                                },
                                function (err) {
                                    log('[-] Connection cannot update key on MongoDB, reason: '+err.message, app_log);
                                    res.redirect('/home/2fa?error=true&code=\'DM001\'');
                                }
                            )
                    },
                    function(err){
                        log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                    }
            );
});

//Jquery method
router.post('/key-enroll-token-secret', function (req, res, next) {
        var registration = u2f.checkRegistration(req.session.u2f, JSON.parse(req.body.registerResponse));

        if(!registration.successful) {
            res.redirect('/home/2fa?error=true&code=\'DM001\'');
        }
        else {
            mdb.connect(mongo_instance)
                .then(
                    function(){
                        mdb.updDocument("users", {email: req.session.email}, { $set: {token_publicKey: registration.publicKey, token_keyHandle: registration.keyHandle }})
                            .then(
                                function () {
                                    log("[+] User "+req.session.email+" successfully saved token secret.", app_log);
                                    log("[+] User "+req.session.email+" successfully saved OTP secret at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                    res.redirect('/home/2fa?error=false');
                                },
                                function (err){
                                    log('[-] Connection cannot update key on MongoDB, reason: '+err.message, app_log);
                                    res.redirect('/home/2fa?error=true&code=\'DM001\'');
                                }
                            );
                    },
                    function(err){
                        log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                    }
                );
        }

});

router.post('/key-upload', function (req, res, next) {
        var sshPublicKey = req.body.pastedPubKey;
        var email = req.session.email;
        var uid = req.body.uid;
                mdb.connect(mongo_instance)
                    .then(
                        function () {
                            p1 = mdb.updDocument("users", {"email": email}, {$set: { sshPublicKey: sshPublicKey }})
                            p2 = ldap.modKey(uid, sshPublicKey)
                            Promise.all([p1, p2])
                                .then(
                                    function () {
                                        // TODO 5 Add to ansible event queue (if user exists, update keys)
                                        log("[+] User "+email+" successfully changed ssh key.", app_log);
                                        log("[+] User "+email+" update ssh public key at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                        res.redirect('/home/keys?error=false');
                                    },
                                    function (err) {
                                        log('[-] Connection cannot update key on MongoDB or LDAP, reason: '+err.message, app_log);
                                        res.redirect('/home/keys?error=true&code=\'DA001\'');
                                    }
                                )
                        },
                        function(err){
                            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        });
});


module.exports = router;

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

//random string generation
var randomstring = require("randomstring");

//AES
var AES_256_CFB = require("../../modules/aes-256-cfb");
var aes_256_cfb = new AES_256_CFB();

//LDAP
var LDAP = require("../../modules/ldap");
var ldap = new LDAP(config.ldap);

//Time format
var ZT = require("../../modules/ztime");
var ztime = new ZT();

//Utils
var UTILS = require("../../modules/utils");
var utils = new UTILS();

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";

//Mail module and templates
const util = require('util');
var nodemailer = require('nodemailer');
const mail = require('../../etc/mailtemplates.json');
const transporter = nodemailer.createTransport({
    port: 25,
    host: 'localhost',
    tls: {
        rejectUnauthorized: false
    }
 });




router.post('/robot-user-add', function (req, res, next) {
    req_hosts = req.body.hosts
    if(!req_hosts){
        req_hosts=[];
    }
    if(!(req_hosts instanceof Array)){
        req_hosts = req_hosts.split();
    }

    //format system user
    var document = {
        sys_username: req.body.uid,
        sshPublicKey: req.body.pastedPubKey,
        pwdChangedTime: ztime.current(),
        pwdAccountLockedTime: null,
        key_last_unlock: "19700101000010Z",
        assigned_hosts: req_hosts,
        key_last_unlock_source: "none",
    };

    mdb.connect(mongo_instance)
    .then(
        function () {
            //password generation
            const password = randomstring.generate(8);

            //encrypt ssh public key
            if (!document.sshPublicKey){
                document.sshPublicKey="";
            }
            else{
                hashsum = utils.hashsum(document.assigned_hosts)
                document.sshPublicKey = aes_256_cfb.AESencrypt(hashsum, document.sshPublicKey);
                console.log(document.sshPublicKey)
            }

            //add user do dbs
            var p1 = mdb.addDocument("robots", document);
            var p2 = ldap.addUser(document.sys_username, req.body.domain, password, document.sshPublicKey);

            Promise.all([p1,p2])
            .then(
                function (value) {
                            log("[+] User "+req.body.uid+" on internal system by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                            log("[+] User "+req.body.uid+" insered successfully on LDAP and MongoDB by: "+req.session.email, app_log);
                            text="User "+req.body.uid+" added to maics, password has been set randomly, if you need the password jump in and reset.<br><br>Request occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+"<br>User agent: "+req.get('User-Agent');
                            admin_mail = "MAICS <"+config.maics.admin_mail+">"
                            admins_mail = "Admins <"+config.maics.admin_mail+">"
                            var message = {
                               from: admin_mail,
                               to: admins_mail,
                               subject: "MAICS - Robot User "+req.body.uid+" added to MAICS",
                               html: util.format(mail.noreset , text)
                            };
                            transporter.sendMail(message, (error, info) => {
                               if (error) {
                                   log('[-] Could not send mail to '+config.maics.admin_mail+': '+error, app_log);
                               }
                               else {
                                   log('[+] Admin warning mail sent to '+config.maics.admin_mail+'.', app_log);
                               }
                             });
                             res.redirect('/users/robots?error=false');
                        },
                        function(err){
                            res.redirect('/users/robots?error=true&code=\'DA001\'');
                        }
                    );
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
            });
});

router.post('/robot-user-delete', function (req, res, next) {
    var sys_username = req.body.sys_username;
    mdb.connect(mongo_instance)
    .then(
        function () {
            var p1 = mdb.delDocument("robots", {"sys_username": sys_username});
            var p2 = mdb.delManyDocuments("access_robots", {"sys_username" : sys_username});
            var p3 = ldap.delUser(sys_username);
            Promise.all([p1, p2, p3])
            .then(
                function () {
                    log("[+] Robot "+sys_username+" deleted in specified timestamp by: "+req.session.email+" from "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                    log("[+] Robot "+sys_username+" deleted from LDAP and MongoDB by: "+req.session.email, app_log);
                    res.redirect('/users/robots?error=false');
                },
                function (err) {
                    log('[-] Connection cannot update MongoDB or LDAP, reason: '+err, app_log);
                    res.redirect('/users/robots?error=true&code=\'DA001\'');
                }
            )
        },
        function(err){
            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
        }
    );
});

router.get('/robot-user-lock', function (req, res, next) {
        var sys_username = req.query.sys_username;
        ldap.lockAccount(sys_username)
        .then(
            function () {
                mdb.connect(mongo_instance)
                .then(
                    function(){
                        mdb.updDocument("robots",{"sys_username": sys_username}, { "$set": {"pwdAccountLockedTime": ztime.current()}})
                        log("[+] User "+sys_username+" locked in specified timestamp by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                        log("[+] User "+sys_username+" locked by: "+req.session.email, app_log);
                        res.redirect('/users/robots?error=false');
                    },
                    function(err){
                        log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                        res.redirect('/users/robots?error=true&code=\'DL001\'');
                    }
                );
            },
            function (err) {
                log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                res.redirect('/users/robots?error=true&code=\'DL001\'');
            }
        );
});

router.get('/robot-user-unlock', function (req, res, next) {
        var sys_username = req.query.sys_username;
        ldap.unlockAccount(sys_username)
        .then(
            function () {
                mdb.connect(mongo_instance)
                .then(
                    function(){
                        mdb.updDocument("robots",{"sys_username": sys_username}, { "$set": {"pwdAccountLockedTime":""}})
                        log("[+] User "+sys_username+" unlocked in specified timestamp by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                        log("[+] User "+sys_username+" unlocked by: "+req.session.email, app_log);
                        res.redirect('/users/robots?error=false');
                    },
                    function(err){
                        log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                        res.redirect('/users/robots?error=true&code=\'DL001\'');
                    }
                )

            },
            function (err) {
                log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                res.redirect('/users/robots?error=true&code=\'DL001\'');
            }
        );
});

router.post('/robot-key-upload', function (req, res, next) {
        var sshPublicKey = req.body.pastedPubKey;
        var sys_username = req.body.sys_username;
                mdb.connect(mongo_instance)
                    .then(
                        function () {
                            mdb.findDocument("robots", {"sys_username":sys_username})
                            .then(
                                function(value){
                                    hashsum = utils.hashsum(value.assigned_hosts)
                                    sshPublicKey = aes_256_cfb.AESencrypt(hashsum, sshPublicKey);

                                    p1 = mdb.updDocument("robots", {"sys_username": sys_username}, {$set: { sshPublicKey: sshPublicKey }})
                                    p2 = ldap.modKey(sys_username, sshPublicKey)
                                    Promise.all([p1, p2])
                                        .then(
                                            function () {
                                                // TODO 5 Add to ansible event queue (if user exists, update keys)
                                                log("[+] User "+sys_username+" successfully changed ssh key.", app_log);
                                                log("[+] User "+sys_username+" update ssh public key at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                                res.redirect('/users/robots?error=false');
                                            },
                                            function (err) {
                                                log('[-] Connection cannot update key on MongoDB or LDAP, reason: '+err.message, app_log);
                                                res.redirect('/users/robots?error=true&code=\'DA001\'');
                                            }
                                        )
                                },
                                function(err){
                                    res.redirect('/users/robots?error=true&code=\'DA001\'');
                                }
                            )
                        },
                        function(err){
                            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        });
});

router.post('/robot-allowed-host-add', function (req, res, next) {
        var host = req.body.host;
        var sys_username = req.body.sys_username;
                mdb.connect(mongo_instance)
                    .then(
                        function () {
                            mdb.findDocument("robots", {"sys_username":sys_username})
                            .then(
                                function(value){
                                    hashsum = utils.hashsum(value.assigned_hosts)
                                    sshPublicKey = aes_256_cfb.AESdecrypt(hashsum, value.sshPublicKey);
                                    value.assigned_hosts.push(host)
                                    hashsum = utils.hashsum(value.assigned_hosts)
                                    sshPublicKey = aes_256_cfb.AESencrypt(hashsum, sshPublicKey);

                                    p1 = mdb.updDocument("robots", {"sys_username": sys_username}, {$set: { sshPublicKey: sshPublicKey, assigned_hosts: value.assigned_hosts }})
                                    p2 = ldap.modKey(sys_username, sshPublicKey)
                                    Promise.all([p1, p2])
                                        .then(
                                            function () {
                                                // TODO 5 Add to ansible event queue (if user exists, update keys)
                                                log("[+] User "+sys_username+" successfully mod allowed hosts ssh key.", app_log);
                                                log("[+] User "+sys_username+" update ssh public key at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                                res.redirect('/users/robots?error=false');
                                            },
                                            function (err) {
                                                log('[-] Connection cannot update key on MongoDB or LDAP, reason: '+err.message, app_log);
                                                res.redirect('/users/robots?error=true&code=\'DA001\'');
                                            }
                                        )
                                },
                                function(err){
                                    res.redirect('/users/robots?error=true&code=\'DA001\'');
                                }
                            )
                        },
                        function(err){
                            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        });
});

router.post('/robot-allowed-host-delete', function (req, res, next) {
        var host = req.body.host;
        var sys_username = req.body.sys_username;
                mdb.connect(mongo_instance)
                    .then(
                        function () {
                            mdb.findDocument("robots", {"sys_username":sys_username})
                            .then(
                                function(value){
                                    hashsum = utils.hashsum(value.assigned_hosts)
                                    sshPublicKey = aes_256_cfb.AESdecrypt(hashsum, value.sshPublicKey);
                                    index = value.assigned_hosts.indexOf(host);
                                    value.assigned_hosts.splice(index, 1);
                                    hashsum = utils.hashsum(value.assigned_hosts)
                                    sshPublicKey = aes_256_cfb.AESencrypt(hashsum, sshPublicKey);

                                    p1 = mdb.updDocument("robots", {"sys_username": sys_username}, {$set: { sshPublicKey: sshPublicKey, assigned_hosts: value.assigned_hosts }})
                                    p2 = ldap.modKey(sys_username, sshPublicKey)
                                    Promise.all([p1, p2])
                                        .then(
                                            function () {
                                                // TODO 5 Add to ansible event queue (if user exists, update keys)
                                                log("[+] User "+sys_username+" successfully mod allowed hosts ssh key.", app_log);
                                                log("[+] User "+sys_username+" update ssh public key at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                                res.redirect('/users/robots?error=false');
                                            },
                                            function (err) {
                                                log('[-] Connection cannot update key on MongoDB or LDAP, reason: '+err.message, app_log);
                                                res.redirect('/users/robots?error=true&code=\'DA001\'');
                                            }
                                        )
                                },
                                function(err){
                                    res.redirect('/users/robots?error=true&code=\'DA001\'');
                                }
                            )
                        },
                        function(err){
                            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        });
});



module.exports = router;

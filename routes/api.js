//Configurations
const config = require('../etc/config.json');

//Web server
var express = require('express');
var app = express();
var session = require('express-session');
var router = express.Router();

//MongoDB
var DB = require("../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";

//RSA
var AES_256_CFB = require("../modules/aes-256-cfb");
var aes_256_cfb = new AES_256_CFB();

//Time format
var ZT = require("../modules/ztime");
var ztime = new ZT();

//random string generation
var randomstring = require("randomstring");

//parse ecdsa public key
var sshpk = require('sshpk');

//Utils
var UTILS = require("../modules/utils");
var utils = new UTILS();

//LDAP
var LDAP = require("../modules/ldap");
var ldap = new LDAP(config.ldap);

//Timer
const timer = ms => new Promise( res => setTimeout(res, ms));


//example query
//curl 'http://10.60.0.24:3000/api/host-add?hostname=hqit-demetra-01&ip=10.60.0.47&port=22&cluster=HQIT&proxy=none'

router.get('/host-add', function (req, res, next) {
    var document = {
        hostname: req.query.hostname,
        ip: req.query.ip,
        port: req.query.port,
        cluster: req.query.cluster,
        proxy: req.query.proxy
    };

    mdb.connect(mongo_instance)
        .then(
            function () {
                var addU = mdb.addDocument("hosts", document);
                var addG = mdb.updDocument("clusters", {name: req.query.cluster}, {$push: {members: document}});
                Promise.all([addU, addG])
                    .then(
                        function () {
                            log('[+] Host '+document.hostname+' Successfully added via API, client ip: '+req.ip.replace(/f/g, "").replace(/:/g, ""),app_log);
                            res.sendStatus(200);
                        },
                        function (err) {
                            log('[-] Error occurred while adding host '+document.hostname+' via API, client ip: '+req.ip.replace(/f/g, "").replace(/:/g, "")+' reason: '+err.message,app_log);
                            res.sendStatus(500);
                        })
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.sendStatus(500);
            });
});

router.post('/challenge', function (req, res, next) {
    mdb.connect(mongo_instance)
        .then(
            function () {
                mdb.findDocument("hosts", { hostname: req.body.host_id, ecdsaPublicKey: {$ne: ""},aesSharedKey: {$ne: ""} })
                .then(
                    function (host) {
                        if(!host){
                            log('[+] Host '+req.body.hostname+' Not found or ecdsaKey not registered, client ip: '+req.ip.replace(/f/g, "").replace(/:/g, ""),app_log);
                            res.status(403).send("host not configured to authenticate via ecdsa");
                        }
                        else{
                            aes_shared_key = host.aesSharedKey
                            dec_ts = aes_256_cfb.AESdecrypt(aes_shared_key, req.body.ts)
                            if(dec_ts.slice(-1)!="Z" || ztime.minutesDiff(dec_ts)>1){
                                res.status(403).send("Could not verify timestamp. "+req.body.host_id+" ts and MAICS time differ "+ztime.minutesDiff(dec_ts)+" minutes.")
                                console.log("SYS:"+ztime.current())
                                console.log("RECV:"+dec_ts)
                                console.log("DELTA:"+ztime.minutesDiff(dec_ts))
                            }else{
                                challenge = randomstring.generate(32);
                                delete host.aesSharedKey;
                                (async function(){
                                    await timer(5000);
                                    req.session = null;
                                })()
                                req.session.ecdsa_host = host;
                                req.session.ecdsa_req_user = req.body.user;
                                req.session.ecdsa_challenge = challenge;
                                enc_challenge = aes_256_cfb.AESencrypt(aes_shared_key, challenge)
                                enc_ts = aes_256_cfb.AESencrypt(aes_shared_key, ztime.current())
                                res.status(200).json({challenge: enc_challenge, ts: enc_ts})
                            }
                        }

                    },
                    function (err) {
                        res.status(500).send();
                    })
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.status(500).send();
            }
        );
});

router.post('/verify-response', function (req, res, next) {
    mdb.connect(mongo_instance)
        .then(
            function () {
                mdb.findDocument("robots", { sys_username: req.session.ecdsa_req_user, assigned_hosts: req.session.ecdsa_host.hostname  })
                .then(
                    function (user) {
                        if(!user){
                            log('[+] Robo-user '+req.session.ecdsa_req_user+' not allowed to host, client ip: '+req.ip.replace(/f/g, "").replace(/:/g, ""),app_log);
                            res.status(403).send("Forbidden. Error will be reported.");
                        }
                        else{
                            keyPub = Buffer.from(req.session.ecdsa_host.ecdsaPublicKey, 'utf8');
                            key = sshpk.parseKey(keyPub, 'ssh');
                            signature = sshpk.parseSignature(req.body.response, "ecdsa", "asn1")

                            /* Make a crypto.Verifier with this key*/
                            var v = key.createVerify('sha256');
                            v.update(req.session.ecdsa_challenge);
                            var valid = v.verify(signature);
                            if(valid){
                                hashsum = utils.hashsum(user.assigned_hosts)
                                sshPublicKey = aes_256_cfb.AESdecrypt(hashsum, user.sshPublicKey);

                                p1 = ldap.modKey(req.session.ecdsa_req_user, sshPublicKey)
                                p2 = mdb.updDocument("robots", {sys_username: req.session.ecdsa_req_user}, { $set: { sshPublicKey: sshPublicKey, key_last_unlock: ztime.current(), key_last_unlock_source: req.session.ecdsa_host.hostname  }})
                                Promise.all([p1])
                                    .then(
                                        function () {
                                            // TODO 5 Add to ansible event queue (if user exists, update keys)
                                            log("[+] User "+req.session.ecdsa_req_user+" successfully unlocked  ssh key.", app_log);
                                            log("[+] User "+req.session.ecdsa_req_user+" successfully unlocked ssh public key at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                            (async function(){
                                                console.log("[*] waiting 5 min before relocking key");
                                                await timer(300000);
                                                a1 = ldap.modKey(req.session.ecdsa_req_user, user.sshPublicKey)
                                                a2 = mdb.updDocument("robots", {sys_username: req.session.ecdsa_req_user}, { $set: { sshPublicKey: user.sshPublicKey }})
                                                Promise.all([a1,a2])
                                                    .then(
                                                        function(){
                                                            console.log("[+] Key relocked for user "+req.session.ecdsa_req_user);
                                                        },
                                                        function(err){
                                                            console.log("[-] Error locking key for user "+req.session.ecdsa_req_user);
                                                        }
                                                    )
                                            })()
                                            res.status(200).send()
                                        },
                                        function (err) {
                                            log('[-] Connection cannot update key on MongoDB or LDAP, reason: '+err.message, app_log);
                                            res.redirect('/users/robots?error=true&code=\'DA001\'');
                                            res.status(500).send()
                                        }
                                    )
                            }
                            else{
                                res.status(403).send("Signature cannot be verified")
                            }
                        }
                    },
                    function (err) {
                        res.sendStatus(500);
                    })
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.sendStatus(500);
            }
        );
});



/***************************************
 *          GROUP MANAGEMENT - END     *
 ***************************************/
module.exports = router;

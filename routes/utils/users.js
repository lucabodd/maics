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

//LDAP
var LDAP = require("../../modules/ldap");
var ldap = new LDAP(config.ldap);

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";

//Mail module and templates
const util = require('util'); //used to format mail with data
var nodemailer = require('nodemailer');
const mail = require('../../etc/mailtemplates.json');

//Time format
var ZT = require("../../modules/ztime");
var ztime = new ZT();



router.post('/user-add', function (req, res, next) {
    //determine if multiple group add has been requested
    var req_groups = req.body.user_groups;
    if(!( req_groups instanceof Array)){
        req_groups = req_groups.split();
    }
    //format system user
    var document = {
        email: req.body.uid+"@"+req.body.domain,
        name: req.body.name,
        surname: req.body.surname,
        sys_username: req.body.uid,
        role: req.body.user_role,
        group: req_groups.join(" "),
        sshPublicKey: "",
        pwdChangedTime: ztime.current(),
        pwdAccountLockedTime: null,
        key_last_unlock: "19700101000010Z",
        otp_secret: "",
        token_publicKey: "",
        token_keyHandle: "",
        otp_enabled: true,
        token_enabled: false
    };

    mdb.connect(mongo_instance)
    .then(
        function () {
            //password generation
            const password = randomstring.generate(8);
            //adding user to DBs
            var p1 = mdb.addDocument("users", document);
            var p2 = ldap.addUser(req.body.uid, req.body.domain, password,"");

            Promise.all([p1,p2])
            .then(
                function (value) {
                    //Deleting attributes to add user in group members
                    delete document.sshPublicKey;
                    delete document.group;
                    delete document.pwdChangedTime;
                    delete document.pwdAccountLockedTime;
                    delete document.key_last_unlock;
                    p3 = req_groups.map(function(grp){
                        if(grp != "none")
                            return mdb.updDocument("groups", {name: grp}, {$push: {members: document}});
                    });
                    p4 = req_groups.map(function(grp){
                        if(grp != "none")
                            return ldap.addUserToGroup(req.body.uid, grp);
                    });

                    //needed to differ promises because node was tryng to add still not created user to group
                    //merge all promises in a unique array
                    var  pAll = [];
                    pAll = p3.concat(p4);

                    Promise.all(pAll)
                    .then(
                        function(){
                            log("[+] User "+req.body.uid+" on internal system by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                            log("[+] User "+req.body.uid+" insered successfully on LDAP and MongoDB by: "+req.session.email, app_log);
                            //sending Mail
                            const transporter = nodemailer.createTransport({
                                port: 25,
                                host: 'localhost',
                                tls: {
                                    rejectUnauthorized: false
                                }
                            });
                            text="User "+document.sys_username+" has been added to SKDC your temporary password is: "+password+" please change it clicking on the button below";
                            var message = {
                                from: config.maics.admin_mail,
                                to: document.email,
                                subject: "SKDC - User "+document.sys_username+" added",
                                html: util.format(mail.standard , text)
                            };

                            transporter.sendMail(message, (error, info) => {
                                if (error) {
                                    log("[!] User "+req.body.uid+" insered successfully on LDAP and MongoDB by: "+req.session.email+" but no mail could be sent, reason: "+error,app_log);
                                    res.render('error', {
                                        message: "500",
                                        error: {status: "Service Unvailable", detail: "Server cannot send mail"}
                                    });
                                }
                                else {
                                    log("[!] User "+req.body.uid+" insered successfully on LDAP and MongoDB by: "+req.session.email+" mail sent. ",app_log);
                                    res.redirect('/users/management?error=false');
                                }
                            });
                        },
                        function(err){
                            log("[!] User "+req.body.uid+" insered successfully on LDAP and MongoDB by: "+req.session.email+" but cannot add it to specified groups: "+err,app_log);
                            res.render('error', {
                                message: "500",
                                error: {status: "Service Unvailable", detail: "Server cannot send mail"}
                            });
                        }
                    );
                },
                function (err) {
                    log('[-] Connection cannot update MongoDB or LDAP, reason: '+err, app_log);
                    res.redirect('/users/management?error=true&code=\'DA001\'');
                })
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
            });
});


/* GET update-keys
* add new user in DB
* This method generate ssh key-pair and update user entry
*/
router.get('/delete-key', function (req, res, next) {

var uname = req.query.sys_username;
var email = req.query.email;
mdb.connect(mongo_instance)
.then(
function () {
    p1 = mdb.updDocument("users", {"email": email}, {$set: { sshPublicKey: undefined }})
    p2 = ldap.modKey(uname, "")
    Promise.all([p1, p2])
    .then(
        function () {
            log("[+] User "+email+" ssh key deleted in specified timestamp by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
            log("[+] User "+email+" updated by: "+req.session.email, app_log);
            res.redirect('/users/management?error=false');
        },
        function (err) {
            log('[-] Connection cannot update MongoDB or LDAP, reason: '+err.message, app_log);
            res.redirect('/users/management?error=true&code=\'DA001\'');
        }
    )
},
function(err){
    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
});

});


router.get('/delete-secret', function (req, res, next) {
var uname = req.query.sys_username;
var email = req.query.email;
mdb.connect(mongo_instance)
.then(
    function () {
        p1 = mdb.updDocument("users", {"email": email}, {$unset: { otp_secret: 1 }})
        .then(
            function () {
                log("[+] User "+email+" OTP secret deleted in specified timestamp by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                log("[+] User "+email+" OTP secret deleted: "+req.session.email, app_log);
                res.redirect('/users/management?error=false');
            },
            function (err) {
                log('[-] Connection cannot update MongoDB, reason: '+err.message, app_log);
                res.redirect('/users/management?error=true&code=\'DM001\'');
            }
        )
    },
    function(err){
        log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
    });

});


router.get('/user-delete', function (req, res, next) {
    var email = req.query.email;
    mdb.connect(mongo_instance)
    .then(
        function () {
            var p1 = mdb.delDocument("users", {"email": email});
            var p2 = mdb.updManyDocuments("groups", {},  {$pull : { "members" : {"email" : email}}});
            var p3 = mdb.delManyDocuments("access_users", {"email" : email});
            var p4 = ldap.delUser(req.query.sys_username);
            Promise.all([p1, p2, p3, p4])
            .then(
                function () {
                    log("[+] User "+email+" deleted in specified timestamp by: "+req.session.email+" from "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                    log("[+] User "+email+" deleted from LDAP and MongoDB by: "+req.session.email, app_log);
                    res.redirect('/users/management?error=false');
                },
                function (err) {
                    log('[-] Connection cannot update MongoDB or LDAP, reason: '+err, app_log);
                    res.redirect('/users/management?error=true&code=\'DA001\'');
                }
            )
        },
        function(err){
            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
        }
    );
});

/* GET user lock
* lock user in ldap
*/
router.get('/user-lock', function (req, res, next) {
        var uname = req.query.sys_username;
        var email = req.query.email;
        ldap.lockAccount(uname)
        .then(
            function () {
                mdb.connect(mongo_instance)
                .then(
                    function(){
                        mdb.updDocument("users",{"sys_username": uname}, { "$set": {"pwdAccountLockedTime": ztime.current()}})
                        log("[+] User "+email+" locked in specified timestamp by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                        log("[+] User "+email+" locked by: "+req.session.email, app_log);
                        res.redirect('/users/management?error=false');
                    },
                    function(err){
                        log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                        res.redirect('/users/management?error=true&code=\'DL001\'');
                    }
                );
            },
            function (err) {
                log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                res.redirect('/users/management?error=true&code=\'DL001\'');
            }
        );
});

router.get('/user-unlock', function (req, res, next) {
        var uname = req.query.sys_username;
        var email = req.query.email;
        ldap.unlockAccount(uname)
        .then(
            function () {
                mdb.connect(mongo_instance)
                .then(
                    function(){
                        mdb.updDocument("users",{"sys_username": uname}, { "$set": {"pwdAccountLockedTime":""}})
                        log("[+] User "+email+" unlocked in specified timestamp by: "+req.session.email+" from"+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                        log("[+] User "+email+" unlocked by: "+req.session.email, app_log);
                        res.redirect('/users/management?error=false');
                    },
                    function(err){
                        log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                        res.redirect('/users/management?error=true&code=\'DL001\'');
                    }
                )

            },
            function (err) {
                log('[-] Connection cannot update LDAP, reason: '+err.message, app_log);
                res.redirect('/users/management?error=true&code=\'DL001\'');
            }
        );
});




module.exports = router;

//Configurations
const config = require('../etc/config.json');

//Web server
var express = require('express');
var app = express();
var router = express.Router();

//MongoDB
var DB = require("../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"
const journal_log = config.maics.log_dir+"journal.log"

//random string generation
var randomstring = require("randomstring");

//Process spawning
const exec = require('child_process').exec;

//LDAP
var LDAP = require("../modules/ldap");
var ldap = new LDAP(config.ldap);

//password validation tool
var passwordValidator = require('password-validator');
var schema = new passwordValidator();
schema
.is().min(8)                                    // Minimum length 8
.is().max(100)                                  // Maximum length 100
.has().uppercase()                              // Must have uppercase letters
.has().lowercase()                              // Must have lowercase letters
.has().digits()                                 // Must have digits
.has().not().spaces()                           // Should not have spaces
.has().symbols()                                // Password must contain a symbol

//Mail module and templates
const util = require('util');
var nodemailer = require('nodemailer');
const mail = require('../etc/mailtemplates.json');

/**************************************
*  Contain routes related to login   *
**************************************/



/* GET login page
* when unauth users go to SKDC lands on this page*/
router.get('/login', function(req, res, next) {
    req.session.email = undefined;
    req.session.role = undefined;
    req.session.key_lock = true;
    req.session.cookie.expires = new Date(Date.now());
    res.render('login');
});


router.post("/password-reset", function (req,res,next) {
    var uid = req.body.sys_username;
    var pwd = randomstring.generate(8);
    mdb.connect(mongo_instance)
    .then(
        function(){
            mdb.findDocument("users", {sys_username: uid}, {email:1})
            .then(
                function(user){
                    if(user != undefined)
                    {
                        ldap.modPwd(uid, pwd)
                        .then(
                            function () {
                                mdb.connect(mongo_instance)
                                .then(
                                    function(){
                                        var now = new Date();
                                        mdb.updDocument("users", {"email": user.email}, {$set: {"pwdChangedTime": now.toISOString().replace(/-/g,"").replace("T","").replace(/:/g,"").slice(0,-5)+"Z"}});
                                        log('[+] Password change password update time for user'+user.email, app_log);
                                    },
                                    function(err){
                                        log('[-] Could not change password update time for user '+user.email+' this is not a fatal error but user account might be locked every 10 minutes', app_log);
                                    }
                                )
                                //sending Mail
                                const transporter = nodemailer.createTransport({
                                    port: 25,
                                    host: 'localhost',
                                    tls: {
                                        rejectUnauthorized: false
                                    }
                                 });
                                 //send mail to admin
                                 text="User "+uid+" asked for a password reset. If you think this is a suspicious activity, please log in and lock account as soon as possible.\nRequest occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User agent: "+req.get('User-Agent');
                                 admin_mail = "SKDC <"+config.maics.admin_mail+">"
                                 admins_mail = "Admins <"+config.maics.admin_mail+">"
                                 var message = {
                                    from: admin_mail,
                                    to: admins_mail,
                                    subject: "SKDC - User "+uid+" asked for password reset",
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
                                 //send mail to user
                                 text="Password for user "+uid+" has been reset successfully. Your temporary password is: "+pwd+" please change it by clicking on the button below and follow the procedure.\n ";
                                 admin_mail = "SKDC <"+config.maics.admin_mail+">"
                                 user_mail = uid+" <"+user.email+">"
                                 var message = {
                                    from: admin_mail,
                                    to: user_mail,
                                    subject: "SKDC - User password "+uid+" reset",
                                    html: util.format(mail.noreset , text)
                                 };

                                 transporter.sendMail(message, (error, info) => {
                                    if (error) {
                                        log('[-] LDAP password has been resetted but mail to '+user.email+' could not be sent, reason: '+err.message, app_log);
                                        res.render('error-500', {
                                            message: "500",
                                            error: {status: "Service Unvailable", detail: "Server cannot send mail"}
                                        });
                                    }
                                    else {
                                        log('[+] LDAP password has been successfully resetted mail to '+user.email+' sent.', app_log);
                                        log('[+] LDAP password has been successfully resetted and sent to '+user.email+' sent. request arrived from '+req.ip.replace(/f/g, "").replace(/:/g, "")+' User-Agent : '+req.get('User-Agent'), journal_log);
                                        res.redirect("/login");
                                    }
                                  });
                            },
                            function (err) {
                                log('[*] cannot modify LDAP password unser might not exist, reason: '+err.message, app_log);
                                res.render('error-500', {
                                    message: "500",
                                    error: {status: "Service Unvailable", detail: "Server cannot handle your request"}
                                });
                            }
                        );
                    }
                    else{
                        log('[*] Unknown user '+uid+' asked for password reset, maybe someone is trying to do something nasty.', app_log);
                        const transporter = nodemailer.createTransport({
                            port: 25,
                            host: 'localhost',
                            tls: {
                                rejectUnauthorized: false
                            }
                         });
                         //send mail to admin
                         text="User "+uid+" asked for a password reset, this user cannot be found in system maybe someone is trying to do something nasty.\nRequest occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User agent: "+req.get('User-Agent');
                         admin_mail = "SKDC <"+config.maics.admin_mail+">"
                         admins_mail = "Admins <"+config.maics.admin_mail+">"
                         var message = {
                            from: admin_mail,
                            to: admins_mail,
                            subject: "SKDC - Unexistent user "+uid+" asked for password reset",
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
                        res.redirect("/login");
                    }
                },
                function(err){
                    log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                    res.render('error-500',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                }
            );
        },
        function(err){
            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
        }
    );
});
module.exports = router;

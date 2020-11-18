//Web server
var express = require('express');
var app = express();
var router = express.Router();

//Errors handling
var Errors = require("../../modules/errors-handling");
var errors = new Errors();

//Configurations
const config = require('../../etc/config.json');

//LDAP
var LDAP = require("../../modules/ldap");
var ldap = new LDAP(config.ldap);

//MongoDB
var DB = require("../../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"
const journal_log = config.maics.log_dir+"journal.log"

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

//UFA
const u2f = require("u2f");
const APP_ID = config.maics.url;


/* GET home page. */
/*********************************************
*  Routes here are defined under             *
* context /utils/
*********************************************/


// Password change
/* POST authentication request
* this request arrives from the login page
* and provide user authentication*/
router.post('/auth', function(req, res, next){
    var pwd = req.body.password;
    var uid = req.body.sys_username;

    ldap.auth(uid, pwd)
    .then(
        function(){
            mdb.connect(mongo_instance)
            .then(
                function(){
                    mdb.findDocument("users",{ sys_username : uid})
                    .then(
                        function(user){
                            if(user == null) {
                                log('[-] No user found in MongoDB, databases might be unaligned', app_log);
                                res.render('login', {unauth: true});
                            }
                            else {
                                //init session vars
                                req.session.email = user.email;
                                req.session.role = user.role;
                                req.session.key_lock = true;
                                req.session.cookie.expires = new Date(Date.now() + (15 * 60 * 1000));
                                req.session.u2f = u2f.request(APP_ID);
                                req.session.otp_verified = false;
                                req.session.token_verified = false;
                                req.session.otp_secret_hash = "";
                                req.session.token_secret_hash = "";

                                log('[+] User '+user.role+' '+req.session.email+' Authenticated Successfully from ip: '+req.ip.replace(/f/g, "").replace(/:/g, "")+' User Agent: '+req.get('User-Agent'), app_log);
                                res.redirect('/home/password-change');
                            }
                        },
                        function(err){ errors.mdb_query_error(res,err); }
                    );
                },
                function (err) { errors.mdb_connection_refused(res, err)}
            );
        },
        function(err){
            log('[*] LDAP Authentication failed for user '+uid+' from ip: '+req.ip.replace(/f/g, "").replace(/:/g, "")+' User Agent: '+req.get('User-Agent'), app_log);
            res.render('login', {unauth: true});
        }
    );
});




router.post('/password-change', function (req,res,next) {
        var sys_username = req.session.email.split("@")[0];
        if((req.body.newpassword == req.body.confirmnewpassword) && (req.body.oldpassword != req.body.newpassword) && schema.validate(req.body.newpassword)){
            var oldPwd = req.body.oldpassword;
            ldap.auth(sys_username, oldPwd)
            .then(
                function(){
                    ldap.modPwd(sys_username, req.body.newpassword)
                    .then(
                        function(user) {
                            mdb.connect(mongo_instance)
                            .then(
                                function(){
                                    var now = new Date();
                                    mdb.updDocument("users", {"email": req.session.email}, {$set: {"pwdChangedTime": now.toISOString().replace(/-/g,"").replace("T","").replace(/:/g,"").slice(0,-5)+"Z"}});
                                    log('[+] Password change password update time for user'+req.session.email, app_log);
                                },
                                function(err){
                                    log('[-] Could not change password update time for user '+req.session.email+' this is not a fatal error but user account might be locked every 10 minutes', app_log);
                                }
                            );
                            log("[+] User "+sys_username+" successfully changed password.", app_log);
                            log("[+] User "+sys_username+" changed password at specified timestamp. change occurred from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                            res.redirect('/home/password-change?error=false');
                        },
                        function(err) {
                            log('[-] Connection to LDAP has been established once, but password could not be changed, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        }
                    )
                },
                function (err) {
                    log('[*] LDAP Authentication failed for user '+sys_username+' from ip: '+req.ip.replace(/f/g, "").replace(/:/g, "")+' User Agent: '+req.get('User-Agent')+' Old password insered by user might not be correct, details:'+err.message, app_log);
                    res.redirect('/home/password-change?error=true&code=\'DL010\'');
                }
            );
        }
        else {
            if(req.body.newpassword != req.body.confirmnewpassword){
                log('[-] Password change for user '+sys_username+' failed: "new password" and "confirm new password" fields did not match', app_log);
                res.redirect('/home/password-change?error=true&code=\'SL010\'');
            }
            else if(req.body.oldpassword == req.body.newpassword){
                log('[-] Password change for user '+sys_username+' failed: "new password" is the same as the old one', app_log);
                res.redirect('/home/password-change?error=true&code=\'SL020\'');
            }
            else if(!schema.validate(req.body.newpassword)){
                log('[-] Password change for user '+sys_username+' failed: New user password did not met the requirements, password won\'t be changed till it met all defined requirements', app_log);
                res.redirect('/home/password-change?error=true&code=\'SL030\'');
            }
        }
});

module.exports = router;

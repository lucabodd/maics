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

//Authenticator
var speakeasy = require("speakeasy");
var QRCode = require('qrcode');

//UFA
const u2f = require("u2f");
const APP_ID = config.maics.url;

/* GET home page. */
/*********************************************
*  Routes here are defined under             *
* context /home/
*********************************************/


router.get('/password-change', function(req, res, next) {
        res.render('password-change', {
            username: req.session.email,
            role: req.session.role,
            error: req.query.error
        });
});

/* GET user add
*  return user add page*/
router.get('/keys', function (req, res, next) {
        var err = ''
        err += req.query.error;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.findDocument("users", { email: req.session.email })
                        .then(
                            function (value) {
                                //parse enabled methods
                                if (value.otp_secret == "" && !value.otp_enabled)
                                    req.session.otp_verified = true
                                if (value.token_publicKey == "" && !value.otp_enabled)
                                    req.session.token_verified = true
                                if (value.token_keyHandle)
                                    req.session.u2f = u2f.request(APP_ID, value.token_keyHandle);

                                res.render('keys', {
                                    name: value.name,
                                    surname: value.surname,
                                    username: req.session.email,
                                    sys_username: value.sys_username,
                                    role: value.role,
                                    groups: value.group,
                                    sshPublicKey: value.sshPublicKey,
                                    sign_challenge: JSON.stringify(req.session.u2f),
                                    key_lock: req.session.key_lock,
                                    url: config.maics.url,
                                    code: req.query.code,
                                    error: err
                                });
                            },
                            function (err) {
                                log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                            }
                        );
                },
                function(err){
                    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                });
});

router.get('/2fa', function(req, res, next) {
        mdb.connect(mongo_instance)
        .then(
            function() {
                mdb.findDocument("users", {email: req.session.email}, {otp_secret: 1, token_publicKey:1})
                .then(
                    function(value){
                        var secret = speakeasy.generateSecret({length: 32});
                        QRCode.toDataURL(secret.otpauth_url.replace("SecretKey", req.session.email), function(err, image_data) {
                            //check if one of MFA is set
                            if(value.otp_secret=="")
                                otp_secret = secret.base32;
                            else
                                otp_secret = "true";
                            if(value.token_publicKey=="")
                                challenge = JSON.stringify(req.session.u2f)
                            else
                                challenge = "true";

                            res.render('2fa', {
                                username: req.session.email,
                                role: req.session.role,
                                otp_secret: otp_secret,
                                otp_qr: image_data,
                                token_challenge: challenge,
                                url: config.maics.url,
                                error: req.query.error
                            });
                        });
                    }, function(err){
                        log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                    }
                );
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
            }
        )
});

router.get('/help', function (req, res, next) {
        res.render('docs');
});

module.exports = router;

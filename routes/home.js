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
                                res.render('keys', {
                                    name: value.name,
                                    surname: value.surname,
                                    username: req.session.email,
                                    sys_username: value.sys_username,
                                    role: value.role,
                                    groups: value.group,
                                    pubKey: value.pubKey,
                                    key_lock: req.session.key_lock,
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
                mdb.findDocument("users", {email: req.session.email}, {otp_secret: 1})
                .then(
                    function(value){
                        console.log(value)
                        //if user has not otp_secret attribute generate the Secret
                        if(!(value.hasOwnProperty('otp_secret')))
                        {
                            var secret = speakeasy.generateSecret({length: 32});
                            QRCode.toDataURL(secret.otpauth_url.replace("SecretKey", req.session.email), function(err, image_data) {
                                res.render('2fa', {
                                    username: req.session.email,
                                    role: req.session.role,
                                    otp_secret: secret.base32,
                                    otp_qr: image_data,
                                    error: req.query.error
                                });
                            });
                        }
                        //user has otp_secret attribute, authenticator setup not shown
                        else
                        {
                            res.render('2fa', {
                                username: req.session.email,
                                role: req.session.role,
                                otp_secret: true,
                                code: req.query.code,
                                error: req.query.error
                            });
                        }
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

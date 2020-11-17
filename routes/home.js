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

router.get('/help', function (req, res, next) {
        res.render('docs');
});

module.exports = router;

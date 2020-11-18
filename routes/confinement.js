//Configurations
const config = require('../etc/config.json');

//Errors handling
var Errors = require("../modules/errors-handling");
var errors = new Errors();


//Web server
var express = require('express');
var app = express();
var router = express.Router();

//MongoDB
var DB = require("../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

router.get('/shells/management', function (req, res, next) {
    res.render('confinement-shells-management',{})
});


module.exports = router;

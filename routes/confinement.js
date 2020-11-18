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

router.get('/shells/command-sets', function (req, res, next) {
    mdb.connect(mongo_instance)
    .then(
        function(){
            var command_sets = mdb.findManyDocuments("command_sets", {})
            Promise.all([command_sets])
            .then(
                function (value) {
                    console.log(value)
                    res.render('confinement-shells-command-sets',{
                        command_sets: value[0]
                    })
                },
                function (err) { errors.mdb_query_error(res, err); }
            )
        },
        function(err) { errors.mdb_connection_refused(res, err); }
    );
});

module.exports = router;

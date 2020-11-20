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
    mdb.connect(mongo_instance)
    .then(
        function(){
            var command_sets = mdb.findManyDocuments("command_sets", {})
            var confinement_shells = mdb.findManyDocuments("confinement_shells", {})

            Promise.all([command_sets, confinement_shells])
            .then(
                function (value) {
                    command_sets_names = value[0].map(function(el){
                        return el.name;
                    })

                    res.render('confinement-shells-management', {
                        command_sets: value[0],
                        confinement_shells: value[1],
                        command_sets_names: command_sets_names,
                        error: req.query.error
                    });
                },
                function (err) { errors.mdb_query_error(res, err); }
            );
        },
        function(err) { errors.mdb_connection_refused(res, err); }
    );

});

router.get('/shells/command-sets', function (req, res, next) {
    mdb.connect(mongo_instance)
    .then(
        function(){
            var command_sets = mdb.findManyDocuments("command_sets", {})
            Promise.all([command_sets])
            .then(
                function (value) {
                    res.render('confinement-shells-command-sets',{
                        command_sets: value[0],
                        error: req.query.error
                    })
                },
                function (err) { errors.mdb_query_error(res, err); }
            )
        },
        function(err) { errors.mdb_connection_refused(res, err); }
    );
});

router.get('/shells/assign', function (req, res, next) {
    mdb.connect(mongo_instance)
    .then(
        function(){
            var users = mdb.findManyDocuments("users", {})
            var confinement_shells = mdb.findManyDocuments("confinement_shells", {})
            var groups = mdb.findManyDocuments("groups", {})
            Promise.all([users, confinement_shells, groups])
            .then(
                function (value) {
                    res.render('confinement-shells-assign',{
                        users: value[0],
                        confinement_shells: value[1],
                        groups: value[2],
                        error: req.query.error
                    })
                },
                function (err) { errors.mdb_query_error(res, err); }
            )
        },
        function(err) { errors.mdb_connection_refused(res, err); }
    );
});

module.exports = router;

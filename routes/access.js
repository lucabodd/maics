//Configurations
const config = require('../etc/config.json');

//Errors handling
var Errors = require("../modules/errors-handling");
var errors = new Errors();

//Web server
var express = require('express');
var app = express();
var session = require('express-session');
var router = express.Router();
//app.use(session({secret: 's3cr3t', saveUninitialized : true, resave : false }));

//MongoDB
var DB = require("../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"
const journal_log = config.maics.log_dir+"journal.log"


/* GET Access page. */
/*********************************************
 *  Contain routes to provide sccess to users*
 *  if noth authed automatic redirection     *
 *  send user to login page                  *
 *********************************************/

/***************************************
 *        ACCESS MANAGEMENT            *
 ***************************************/
router.get('/users', function(req, res, next) {
        var err = ''
        err += req.query.error;

        mdb.connect(mongo_instance)
            .then(
                function () {
                    var hosts = mdb.findManyDocuments("hosts", {});
                    var hostgroups = mdb.findManyDocuments("hostgroups", {});
                    var users = mdb.findManyDocuments("users", {"role" : "technician"},{
                            name: 1,
                            surname: 1,
                            email: 1,
                            sys_username: 1,
                            role: 1,
                            group: 1,
                            sshPublicKey: 1
                    });
                    var groups = mdb.findManyDocuments("groups", {});
                    var access = mdb.findManyDocuments("access_users", {});
                    Promise.all([hosts, hostgroups, users, groups,access])
                        .then(
                            function (value) {
                                res.render('access-users', {
                                    hosts: value[0],
                                    hostgroups: value[1],
                                    users: value[2],
                                    groups: value[3],
                                    access: value[4],
                                    error: err,
                                    code: req.query.code,
                                    sys_username: req.session.sys_username,
                                    role: req.session.role
                                });
                            },
                            function (err) { errors.mdb_query_error(res, err); }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.get('/groups', function(req, res, next) {
        var err = ''
        err += req.query.error;

        mdb.connect(mongo_instance)
            .then(
                function () {
                    var hosts = mdb.findManyDocuments("hosts", {});
                    var hostgroups = mdb.findManyDocuments("hostgroups", {});
                    var users = mdb.findManyDocuments("users", {},{
                            name: 1,
                            surname: 1,
                            email: 1,
                            sys_username: 1,
                            role: 1,
                            group: 1,
                            sshPublicKey: 1
                    });
                    var groups = mdb.findManyDocuments("groups", {});
                    var access = mdb.findManyDocuments("access_groups", {});
                    Promise.all([hosts, hostgroups, users, groups,access])
                        .then(
                            function (value) {
                                res.render('access-groups', {
                                    hosts: value[0],
                                    hostgroups: value[1],
                                    users: value[2],
                                    groups: value[3],
                                    access: value[4],
                                    error: err,
                                    code: req.query.code,
                                    sys_username: req.session.sys_username,
                                    role: req.session.role
                                });
                            },
                            function (err) { errors.mdb_query_error(res, err); }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.get('/robots', function(req, res, next) {
        var err = ''
        err += req.query.error;

        mdb.connect(mongo_instance)
            .then(
                function () {
                    var hosts = mdb.findManyDocuments("hosts", {ecdsaPublicKey: {$ne: ""}});
                    var hostgroups = mdb.findManyDocuments("hostgroups", {});
                    var robots = mdb.findManyDocuments("robots", {});
                    var access = mdb.findManyDocuments("access_robots", {});
                    Promise.all([hosts, hostgroups, robots, access])
                        .then(
                            function (value) {
                                res.render('access-robots', {
                                    hosts: value[0],
                                    hostgroups: value[1],
                                    robots: value[2],
                                    access_robots: value[3],
                                    error: err,
                                    code: req.query.code,
                                    sys_username: req.session.sys_username,
                                    role: req.session.role
                                });
                            },
                            function (err) { errors.mdb_query_error(res, err); }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});



router.get('/compliance', function(req, res, next) {
        var err = ''
        err += req.query.error;

        res.render('access-compliance', {
            sys_username: req.session.sys_username,
            role: req.session.role,
            error: err
        });

});


module.exports = router;

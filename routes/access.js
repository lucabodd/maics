//Configurations
const config = require('../etc/config.json');

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
                                    username: req.session.email,
                                    role: req.session.role
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
                                    username: req.session.email,
                                    role: req.session.role
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

router.get('/compliance', function(req, res, next) {
        var err = ''
        err += req.query.error;

        res.render('access-compliance', {
            error: err
        });

});


module.exports = router;

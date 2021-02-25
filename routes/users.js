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

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";

//Time format
var ZT = require("../modules/ztime");
var ztime = new ZT();



/**************************************
 *  Contain routes for user management*
 *  (See nav bar under item "User")   *
 **************************************/

router.get('/management', function (req, res, next) {
        var err = ''
        err += req.query.error;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var users = mdb.findManyDocuments("users", {}, {name: 1, surname: 1, email: 1, group: 1, role: 1, sys_username:1, pwdAccountLockedTime:1, sshPublicKey:1, otp_secret: 1});
                    var userCount = mdb.countCollectionItems("users");
                    var groups = mdb.findManyDocuments("groups", {});
                    Promise.all([users, userCount, groups])
                        .then(
                            function (value) {
                                res.render('users-management', {
                                    users: value[0],
                                    user_count: value[1],
                                    sys_username: req.session.sys_username,
                                    role: req.session.role,
                                    groups: value[2],
                                    code: req.query.code,
                                    error: err
                                });
                            },
                            function (err) { errors.mdb_query_error(res, err); }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.get('/robots', function (req, res, next) {
        var err = ''
        err += req.query.error;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var users = mdb.findManyDocuments("robots", {});
                    var userCount = mdb.countCollectionItems("robots");
                    var hosts = mdb.findManyDocuments("hosts", {ecdsaPublicKey: {$ne: ""}}, {hostname:1});
                    Promise.all([users, userCount, hosts])
                        .then(
                            function (value) {
                                host_names = value[2].map(function(el){
                                    return el.hostname;
                                })
                                users = value[0].map(function(el){
                                    el.key_last_unlock = ztime.convertToHumanReadable(el.key_last_unlock)
                                    return el
                                })
                                res.render('users-robots', {
                                    users: users,
                                    user_count: value[1],
                                    hosts: value[2],
                                    host_names:host_names,
                                    sys_username: req.session.sys_username,
                                    role: req.session.role,
                                    code: req.query.code,
                                    error: err
                                });
                            },
                            function (err) { errors.mdb_query_error(res, err); }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.get('/groups', function (req, res, next) {
        var err = ''
        err += req.query.error;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    //to be displayed in select options
                    var users = mdb.findManyDocuments("users", {}, {
                        name: 1,
                        surname: 1,
                        email: 1,
                        sys_username: 1,
                        group: 1,
                        role: 1,
                    });
                    var groupCount = mdb.countCollectionItems("groups");
                    var groups = mdb.findManyDocuments("groups", {});
                    Promise.all([users, groupCount, groups])
                        .then(
                            function (value) {
                                res.render('users-groups', {
                                    users: value[0],
                                    group_count: value[1],
                                    sys_username: req.session.sys_username,
                                    role: req.session.role,
                                    groups: value[2],
                                    code: req.query.code,
                                    error: err
                                });
                            },
                            function (err) { errors.mdb_query_error(res, err); }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});


 router.get('/roles', function (req, res, next) {
         var err = ''
         err += req.query.error;
         mdb.connect(mongo_instance)
             .then(
                 function () {
                     var users = mdb.findManyDocuments("users", {}, {name: 1, surname: 1, email: 1, group: 1, role: 1, sys_username:1 });
                     var userCount = mdb.countCollectionItems("users");
                     var groups = mdb.findManyDocuments("groups", {});
                     Promise.all([users, userCount, groups])
                         .then(
                             function (value) {
                                 res.render('users-roles', {
                                     users: value[0],
                                     user_count: value[1],
                                     sys_username: req.session.sys_username,
                                     role: req.session.role,
                                     groups: value[2],
                                     code: req.query.code,
                                     error: err
                                 });
                             },
                             function (err) { errors.mdb_query_error(res, err); }
                         );
                 },
                 function(err) { errors.mdb_connection_refused(res, err); }
             );
 });


module.exports = router;

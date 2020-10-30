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

//process spawning
const exec = require('child_process').exec

/* GET hosts page. */
/*********************************************
 *  Contain routes to provide host-mgmt pages*
 *  if noth authed automatic redirection     *
 *  send user to login page                  *
 *********************************************/

/***************************************
 *          HOST MANAGEMENT            *
 ***************************************/

/* GET user add
*  return user add page*/
router.get('/management', function (req, res, next) {
        var err = ''
        err += req.query.error;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var hosts = mdb.findManyDocuments("hosts", {});
                    var hostCount = mdb.countCollectionItems("hosts");
                    var clusters = mdb.findManyDocuments("hostgroups", {});
                    Promise.all([hosts, hostCount, clusters])
                        .then(
                            function (value) {
                                res.render('hosts-management', {
                                    hosts: value[0],
                                    host_count: value[1],
                                    username: req.session.email,
                                    role: req.session.role,
                                    hostgroups: value[2],
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
/***************************************
 *      HOST MANAGEMENT - END          *
 ***************************************/


/***************************************
 *    HOST GROUPS MANAGEMENT           *
 ***************************************/

/* GET user add
 * return user add page*/
router.get('/hostgroups', function (req, res, next) {
        var err = ''
        err += req.query.error;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var hosts = mdb.findManyDocuments("hosts", {});
                    var clusterCount = mdb.countCollectionItems("hostgroups");
                    var clusters = mdb.findManyDocuments("hostgroups", {});
                    Promise.all([hosts, clusterCount, clusters])
                        .then(
                            function (value) {
                                res.render('hosts-hostgroups', {
                                    hosts: value[0],
                                    cluster_count: value[1],
                                    username: req.session.email,
                                    role: req.session.role,
                                    hostgroups: value[2],
                                    error: err,
                                    code: req.query.code
                                });
                            },
                            function (err) {
                                log('[-] Connection to MongoDB has been established, but not all queryes can be satisfied, reason: '+err.message, app_log);
                                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                            }
                        );
                },
                function(err){
                    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                });
});


module.exports = router;

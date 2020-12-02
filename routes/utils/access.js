//Configurations
const config = require('../../etc/config.json');

//Web server
var express = require('express');
var app = express();
var session = require('express-session');
var router = express.Router();
//app.use(session({secret: 's3cr3t', saveUninitialized : true, resave : false }));

//MongoDB
var DB = require("../../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"
const journal_log = config.maics.log_dir+"journal.log"


/****************************************
 *        Access for users              *
 ****************************************/
router.post('/access-user2host', function (req ,res,next){
        var users = req.body.user
        var hosts = req.body.host

        if(!(users instanceof Array)){
            users = users.split();
        }
        if(!(hosts instanceof Array)){
            hosts = hosts.split();
        }

        hosts.forEach(function(h){
            users.forEach(function(u){
                var udata = JSON.parse(u);
                var hdata = JSON.parse(h);
                var doc={
                  name: udata.name,
                  surname: udata.surname,
                  sys_username: udata.sys_username,
                  email: udata.email,
                  hostname: hdata.hostname
                };
                mdb.connect(mongo_instance)
                   .then(
                       function() {
                           mdb.addDocument("access_users", doc)
                               .then(
                                   function () {
                                       log("[+] Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email, app_log);
                                       log("[+] Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                       res.redirect('/access/users?error=false');
                                   },
                                   function (err) {
                                       log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                       res.redirect('/access/users?error=true&code=\'DM001\'');
                                   }
                               )
                       },
                       function(err)
                       {
                           log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                           res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                       }
                   );
            });
        });
});

router.post('/access-user2hostgroup', function (req ,res,next) {
        var users = req.body.user
        var hostgroup = req.body.hostgroup

        if(!(users instanceof Array)){
            users = users.split();
        }
        if(!(hostgroup instanceof Array)){
            hostgroup = hostgroup.split();
        }

        hostgroup.forEach(function(cls){
            users.forEach(function(usr){
                var udata = JSON.parse(usr);
                var hdata = JSON.parse(cls);
                mdb.connect(mongo_instance)
                    .then(
                        function () {
                            hdata.forEach(function (h) {
                                var doc = {
                                    name: udata.name,
                                    surname: udata.surname,
                                    sys_username: udata.sys_username,
                                    email: udata.email,
                                    hostname: h.hostname
                                };
                                mdb.addDocument("access_users", doc)
                                    .then(
                                        function () {
                                            log("[+] Bulk Action - Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email, app_log);
                                            log("[+] Bulk Action - Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                        },
                                        function (err) {
                                            log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                        }
                                    );
                            });
                            res.redirect('/access/users?error=false');
                        },
                        function (err) {
                            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        });
                });
        });
});

router.get('/access-user-delete', function (req, res, next) {
        var email = req.query.email;
        var hostname = req.query.hostname;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var p1 = mdb.delDocument("access_users", {"email": email, "hostname": hostname});
                    Promise.all([p1])
                        .then(
                            //TODO 5 add ansible event queue
                            function () {
                                log("[+] Access for user: "+email+" at "+hostname+" removed by user: "+req.session.email, app_log);
                                log("[+] Access for user: "+email+" at "+hostname+" removed by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                res.redirect('/access/users?error=false');
                            },
                            function (err) {
                                log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                res.redirect('/access/users?error=true&code=\'DM001\'');
                            }
                        )
                }
            )
});
/****************************************
 *        Access for groups              *
 ****************************************/

router.post('/access-group2host', function (req ,res,next) {
        var groups = req.body.groups
        var hosts = req.body.hosts

        if(!(groups instanceof Array)){
            groups = groups.split();
        }
        if(!(hosts instanceof Array)){
            hosts = hosts.split();
        }

        mdb.connect(mongo_instance)
            .then(
                function () {
                    var ctr = 0 ;
                    groups.forEach(function(g){
                        ctr++;
                        hosts.forEach(function(h){
                            mdb.addDocument("access_groups", {"group": g, "hostname": h })
                            .then(
                                function () {
                                    log("[+] Bulk Action - Access Granted for user: From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                },
                                function (err) {
                                    log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                }
                            );
                        });
                        if (ctr == groups.length){
                            res.redirect('/access/groups?error=false')
                        }
                    });
                    },
                    function (err) {
                        log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                    }
                );
});



router.post('/access-group2hostgroup', function (req ,res,next) {
        var group = req.body.group
        var hostgroup = req.body.hostgroup

        if(!(group instanceof Array)){
            group = group.split();
        }
        if(!(hostgroup instanceof Array)){
            hostgroup = hostgroup.split();
        }

        mdb.connect(mongo_instance)
            .then(
                function(){
                    var ctr = 0;
                    group.forEach(function(g){
                        ctr ++;
                        hostgroup.forEach(function(h){
                            var hmembers = JSON.parse(h);
                            hmembers.forEach(function (host) {
                                mdb.addDocument("access_groups", {"group":g, "hostname": host.hostname })
                                      .then(
                                          function () {
                                              log("[+] Bulk Action - Access Granted for user by user: "+req.session.email, app_log);
                                              log("[+] Bulk Action - Access Granted for user:  by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                          },
                                          function (err) {
                                              log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                          }
                                      );
                            });
                        });
                        if (ctr == group.length){
                            res.redirect('/access/groups?error=false')
                        }
                    });
                },
                function(err){
                    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                }
            ); //end new
});

router.get('/access-group-delete', function (req, res, next) {
        var group = req.query.group;
        var hostname = req.query.hostname;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var p1 = mdb.delDocument("access_groups", {"group": group, "hostname": hostname});
                    Promise.all([p1])
                        .then(
                            //TODO 5 add ansible event queue
                            function () {
                                log("[+] Access for user: emoved by user: "+req.session.email, app_log);
                                log("[+] Access for user: removed by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                res.redirect('/access/groups?error=false');
                            },
                            function (err) {
                                log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                res.redirect('/access/groups?error=true&code=\'DM001\'');
                            }
                        )
                }
            )
});

router.post('/access-robot2host', function (req ,res,next){
        var robots = req.body.robots
        var hosts = req.body.host

        if(!(robots instanceof Array)){
            robots = robots.split();
        }
        if(!(hosts instanceof Array)){
            hosts = hosts.split();
        }

        hosts.forEach(function(h){
            robots.forEach(function(u){
                var doc={
                  sys_username: u,
                  hostname: h
                };
                mdb.connect(mongo_instance)
                   .then(
                       function() {
                           mdb.addDocument("access_robots", doc)
                               .then(
                                   function () {
                                       log("[+] Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email, app_log);
                                       log("[+] Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                       res.redirect('/access/robots?error=false');
                                   },
                                   function (err) {
                                       log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                       res.redirect('/access/robots?error=true&code=\'DM001\'');
                                   }
                               )
                       },
                       function(err)
                       {
                           log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                           res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                       }
                   );
            });
        });
});

router.post('/access-robot2hostgroup', function (req ,res,next) {
        var robots = req.body.robots
        var hostgroup = req.body.hostgroup

        if(!(robots instanceof Array)){
            robots = robots.split();
        }
        if(!(hostgroup instanceof Array)){
            hostgroup = hostgroup.split();
        }

        hostgroup.forEach(function(cls){
            robots.forEach(function(usr){
                var hdata = JSON.parse(cls);
                mdb.connect(mongo_instance)
                    .then(
                        function () {
                            hdata.forEach(function (h) {
                                var doc = {
                                    sys_username: usr,
                                    hostname: h.hostname
                                };
                                mdb.addDocument("access_robots", doc)
                                    .then(
                                        function () {
                                            log("[+] Bulk Action - Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email, app_log);
                                            log("[+] Bulk Action - Access Granted for user: "+doc.sys_username+"@"+doc.hostname+" by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                        },
                                        function (err) {
                                            log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                        }
                                    );
                            });
                            res.redirect('/access/robots?error=false');
                        },
                        function (err) {
                            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        });
                });
        });
});

router.get('/access-robot-delete', function (req, res, next) {
        var sys_username = req.query.sys_username;
        var hostname = req.query.hostname;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var p1 = mdb.delDocument("access_robots", {"sys_username": sys_username, "hostname": hostname});
                    Promise.all([p1])
                        .then(
                            //TODO 5 add ansible event queue
                            function () {
                                log("[+] Access for user: "+sys_username+" at "+hostname+" removed by user: "+req.session.email, app_log);
                                log("[+] Access for user: "+sys_username+" at "+hostname+" removed by user: "+req.session.email+" From: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                res.redirect('/access/robots?error=false');
                            },
                            function (err) {
                                log('[!] Connection to MongoDB has been established, but error occurred, reason: '+err.message, app_log);
                                res.redirect('/access/robots?error=true&code=\'DM001\'');
                            }
                        )
                }
            )
});

/****************************************
 *        report and hournal download   *
 ****************************************/
 router.get('/download-report', function (req, res, next) {
         res.download(config.maics.dir+"report/access-mtrx.xlsx");
 });

 router.get('/download-journal', function (req, res, next) {
         res.download(config.maics.log_dir+"journal.log");
 });

module.exports = router;

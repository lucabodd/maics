//Configurations
const config = require('../../etc/config.json');

//Web server
var express = require('express');
var app = express();
var router = express.Router();

//MongoDB
var DB = require("../../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"


/* POST add new group
*  when group is created, there are no members inside */
router.post('/hostgroup-add', function (req, res, next) {
        var hostgroup = req.body.hostgroup;
        hostgroup = hostgroup.replace(/ /g, "");
        document = {
            name: hostgroup,
            members: []
        };
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.addDocument("hostgroups", document)
                        .then(
                            function () {
                                log('[+] Cluster '+document.name+' Successfully added from user : '+req.session.email, app_log);
                                res.redirect('/hosts/hostgroups?error=false');
                            },
                            function (err) {
                                log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                            }
                        )
                },
                function (err) {
                    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                }
            );
});

/* POST ADD USER TO A GROUP
 * add a new object to members array of a group
 */
router.post('/hostgroup-add-hosts', function (req, res, next) {
        var req_hostgroup = req.body.hostgroup;
        var req_hosts = req.body.host;

        if(!(req_hosts instanceof Array)){
            req_hosts = req_hosts.split();
        }
        if(!(req_hostgroup instanceof Array)){
            req_hostgroup = req_hostgroup.split();
        }

        mdb.connect(mongo_instance)
            .then(
                function(){
                    var ctr = 0;
                    req_hostgroup.forEach(function(hostgroup){
                        req_hosts.forEach(function(h){
                            var host = JSON.parse(h)
                            mdb.findDocument("hostgroups",{"name": hostgroup ,"members.hostname": host.hostname})
                            .then(
                                function (value) {
                                    if (!value) {
                                        delete host.hostgroups;
                                        mdb.updDocument("hostgroups", {name: hostgroup}, {$push: {members: host}})
                                            .then(
                                                function () {
                                                    mdb.findManyDocuments("hostgroups", { "members.hostname" : host.hostname}, { name : 1})
                                                        .then(
                                                            function(rset_grps){
                                                                if(!rset_grps){
                                                                    grps = ["none"];
                                                                }
                                                                else{
                                                                    grps = rset_grps.map(function(g){
                                                                        return g.name;
                                                                    });
                                                                    if(grps.length==0){
                                                                        grps = ["none"];
                                                                    }
                                                                }
                                                                mdb.updDocument("hosts", {"hostname" : host.hostname}, { $set: { "hostgroups": grps.join(" ")}})
                                                                    .then(
                                                                        function(){
                                                                            log('[+] Host '+host.hostname+' Successfully added to cluster '+hostgroup+' from user : '+req.session.email, app_log);
                                                                        },
                                                                        function(err){
                                                                            log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                                                            res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                                                        }
                                                                    );
                                                            },
                                                            function(err){
                                                                log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                                                res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                                            }
                                                        );
                                                },
                                                function (err) {
                                                    log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                                    res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                                }
                                            );
                                    }
                                    else {
                                        log('[!] Host '+host.hostname+' alread added to cluster '+hostgroup+'skipping ...', app_log);
                                    }
                                },
                                function (err) {
                                    log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                    res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                });
                        });
                        ctr++;
                        if (ctr == req_hostgroup.length)
                        {
                            res.redirect('/hosts/hostgroups?error=false');
                        }
                    });
                },
                function(err){
                    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                }
            );//end new
});


/* POST group-delete
 * delete an entire group
 */
router.post('/hostgroups-delete', function (req, res, next) {
        var req_hostgroups = req.body.hostgroups;
        if(!(req_hostgroups instanceof Array)){
            req_hostgroups = req_hostgroups.split();
        }


        mdb.connect(mongo_instance)
            .then(
                function(){
                    p1 = req_hostgroups.map(function(g){
                        return mdb.delDocument("hostgroups", {"name": g})
                    })

                    Promise.all(p1)
                        .then(
                            function(){
                                var ctr = 0;
                                req_hostgroups.forEach(function(g){
                                    mdb.findManyDocuments("hosts", { "hostgroups" : { $regex : g}})
                                        .then(
                                            function(rset_hosts){
                                                rset_hosts.forEach(function(h){
                                                    mdb.findManyDocuments("hostgroups", { "members.hostname" : h.hostname}, { name : 1})
                                                        .then(
                                                            function(rset_grps){
                                                                if(!rset_grps){
                                                                    grps = ["none"];
                                                                }
                                                                else{
                                                                    grps = rset_grps.map(function(g){
                                                                        return g.name;
                                                                    });
                                                                    if(grps.length==0){
                                                                        grps = ["none"];
                                                                    }
                                                                }
                                                                mdb.updDocument("hosts", {"hostname" : h.hostname}, { $set: { "hostgroups": grps.join(" ")}})
                                                                    .then(
                                                                        function(){
                                                                            log('[+] Host '+h.hostname+' Successfully added to cluster '+g+' from user : '+req.session.email, app_log);
                                                                        },
                                                                        function(err){
                                                                            log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                                                            res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                                                        }
                                                                    );
                                                            },
                                                            function(err){
                                                                log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                                                res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                                            }
                                                        );
                                                });
                                            },
                                            function(err){
                                                log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                                res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                            }
                                        );
                                    ctr++;
                                    if (ctr == req_hostgroups.length)
                                    {
                                        res.redirect('/hosts/hostgroups?error=false');
                                    }
                                });
                            }
                        );
                    },
                    function(err){
                        log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                    }
                );
});

/* GET group-user-delete
 * Delete a user entry from a group (pull from stored array)
 */
router.get('/hostgroup-delete-host', function (req, res, next) {
        var hostname = req.query.hostname;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.updDocument("hostgroups", {"name": req.query.hostgroup}, {$pull: {"members": {"hostname": hostname}}})
                        .then(
                            function(){
                                mdb.findManyDocuments("hostgroups", { "members.hostname" : hostname}, { name : 1})
                                    .then(
                                        function(rset_grps){
                                            if(!rset_grps){
                                                grps = ["none"];
                                            }
                                            else{
                                                grps = rset_grps.map(function(g){
                                                    return g.name;
                                                });
                                                if(grps.length==0){
                                                    grps = ["none"];
                                                }
                                            }
                                            mdb.updDocument("hosts", {"hostname" : hostname}, { $set: { "hostgroups": grps.join(" ")}})
                                                .then(
                                                    function(){
                                                        log("[+] Host " + hostname + " deleted successfully from cluser from user"+req.session.email, app_log);
                                                        res.redirect('/hosts/hostgroups?error=false');
                                                    },
                                                    function(err){
                                                        log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                                        res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                                    }
                                                );
                                        },
                                        function(err){
                                            log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                            res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                                        }
                                    );
                            },
                            function (err) {
                                log('[-] Connection to MongoDB has been established, but query can be satisfied, reason: '+err.message, app_log);
                                res.redirect('/hosts/hostgroups?error=true&code=\'DM001\'');
                            }
                        );
                },
                function(err){
                    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                });
});


 module.exports = router;

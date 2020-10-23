//Web server
var express = require('express');
var app = express();
var router = express.Router();
var session = require('express-session');

//Configurations
const config = require('../../etc/config.json');

//MongoDB
var DB = require("../../modules/db");
const { MongoClient, ObjectId } = require('mongodb'); //define objectid
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//LDAP
var LDAP = require("../../modules/ldap");
var ldap = new LDAP(config.ldap);

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";


/* POST add new group
*  when group is created, there are no members inside */
router.post('/group-add', function (req, res, next) {
        document = {
            name: req.body.group_name,
            members: []
        };
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var addMdb = mdb.addDocument("groups", document)
                    var addLDAP = ldap.addGroup(document.name)
                    Promise.all([addMdb, addLDAP])
                        .then(
                            function () {
                                log("[+] Group "+document.name+" added by: "+req.session.email, app_log);
                                res.redirect('/users/groups?error=false');
                            },
                            function (err) {
                                log('[-] Connection to MongoDB or LDAP has been established, but no query can be performed, reason: '+err.message, app_log);
                                res.redirect('/users/groups?error=true&code=\'DM001\'');
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
router.post('/group-add-user', function (req, res, next) {
        var req_users = req.body.users;
        var req_groups = req.body.groups;

        if(!(req_users instanceof Array)){
            req_users = req_users.split();
        }
        if(!(req_groups instanceof Array)){
            req_groups = req_groups.split();
        }

        mdb.connect(mongo_instance)
            .then(
                function () {
                    var ctr = 0;
                    req_users.forEach(function(u){
                        req_groups.forEach(function(group){
                            mdb.findDocument("groups",{"name": group ,"members.email": JSON.parse(u).email})
                                .then(
                                    function (value) {
                                        if (!value) {
                                            var user = JSON.parse(u);
                                            user._id = ObjectId(user._id)
                                            strgroup = user.group+" "+req_groups.join(" ");
                                            strgroup = strgroup.replace("none ", "");
                                            var updU = mdb.updDocument("users", {"email" : user.email}, { $set: { "group": strgroup}})
                                            delete user.group
                                            var addG = mdb.updDocument("groups", {name: group}, {$push: {members: user}})
                                            var addGLDAP = ldap.addUserToGroup(user.sys_username, group)
                                            Promise.all([addG, updU, addGLDAP])
                                                .then(
                                                    function (value) {
                                                        log("[+] User "+user+" added to group "+group+" by: "+req.session.email, app_log);
                                                    },
                                                    function (err) {
                                                        log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                                        res.redirect('/users/groups?error=true&code=\'DM001\'');
                                                    });
                                        }
                                        else {
                                            log('[-] User already added to this group, skipping ...', app_log);
                                            res.redirect('/users/groups?error=true&code=\'SG010\'');
                                        }
                                    },
                                    function (err) {
                                        log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                        res.redirect('/users/groups?error=true&code=\'DM001\'');
                                    });
                        });
                        ctr++;
                        if (ctr == req_users.length)
                        {
                            res.redirect('/users/groups?error=false');
                        }
                    });
                },
                function (err) {
                    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                    res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                }
            );//end new
});


/* POST group-delete
 * delete an entire group
 */
router.post('/group-delete', function (req, res, next) {
        var groups = req.body.groups;
        if(!(groups instanceof Array)){
            groups = groups.split();
        }

        mdb.connect(mongo_instance)
        .then(
            function(){
                p1 = groups.map(function(g){
                    return ldap.delGroup(g);
                });
                p2 = groups.map(function(g){
                    return mdb.delDocument("groups", {"name": g});
                });
                p3 = groups.map(function(g){
                    return mdb.delDocument("access_groups", {"group": g});
                });

                //collect all promises
                var pAll = [];
                pAll = p1.concat(p2, p3);
                Promise.all(pAll)
                    .then(
                        function(){
                            //group consistency to user collection
                            groups.forEach(function(g){
                                mdb.findManyDocuments("users", { "group" : { $regex : g}})
                                    .then(
                                        function(u){
                                            u.forEach(function(us){
                                                ldap.getUserGroups(us.sys_username)
                                                    .then(
                                                        function(ldap_groups){
                                                            mdb.updDocument("users", {"sys_username": us.sys_username}, { $set : {"group": ldap_groups.join(" ") }})
                                                                .then(
                                                                    function(){
                                                                        log('[+] Consistency propagated to user collection: ', app_log);
                                                                    },
                                                                    function(err){
                                                                        log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err, app_log);
                                                                    }
                                                                );
                                                        },
                                                        function(err){
                                                            log('[-] Connection to LDAP has been established, but no query can be performed, reason: '+err, app_log);
                                                        }
                                                    );
                                            });
                                        },
                                        function(err){
                                            log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err, app_log);
                                        }
                                    );
                            });
                            res.redirect('/users/groups?error=false');
                        },
                        function (err) {
                            log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err, app_log);
                            res.redirect('/users/groups?error=true&code=\'DM001\'');
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
router.get('/group-delete-user', function (req, res, next) {
        var email = req.query.email;
        var sys_username = req.query.sys_username;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var p1 = ldap.delUserFromGroup(sys_username, req.query.group)
                    var p2 = mdb.updDocument("groups", {"name" : req.query.group },{ $pull :{ "members" : { "email" : email}}})
                    Promise.all([p1,p2])
                        .then(
                            function () {
                                /* Consistency to users collection, keeps group field aligned */
                                ldap.getUserGroups(sys_username)
                                .then(
                                    function(ldap_groups){
                                        mdb.updDocument("users", {"sys_username": sys_username}, { $set: {"group": ldap_groups}})
                                        .then(
                                            function () {
                                                log('[+] Groups propagating consistency to Users collection : ', app_log);
                                                res.redirect('/users/groups?error=false');
                                            },
                                            function (err) {
                                                log('[-] Failed propagating consistency to User collection, application will keep on working but this is not good : '+err.message, app_log);
                                                res.redirect('/host-groups?error=true&code=\'DM001\'');
                                            }
                                        );
                                    },
                                    function(err){
                                        log('[-] Connection to LDAP has been established, but no query can be performed, reason: '+err, app_log);
                                        res.redirect('/host-groups?error=true&code=\'DM001\'');
                                    }
                                );
                            },
                            function (err) {
                                log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                res.redirect('/host-groups?error=true&code=\'DM001\'');
                            }
                        );
                    },
                    function (err) {
                        log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                    }
                );

});

module.exports = router;

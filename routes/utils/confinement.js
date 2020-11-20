//Configurations
const config = require('../../etc/config.json');

//Errors handling
var Errors = require("../../modules/errors-handling");
var errors = new Errors();

//Web server
var express = require('express');
var app = express();
var router = express.Router();

//MongoDB
var DB = require("../../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//LDAP
var LDAP = require("../../modules/ldap");
var ldap = new LDAP(config.ldap);

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";


router.post('/command-set-add', function (req, res, next) {
        name = req.body.command_set_name.replace(/ /g, "");
        document = {
            name: name,
            commands: []
        };

        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.addDocument("command_sets", document)
                        .then(
                            function () {
                                log("[+] Command set "+document.name+" added by: "+req.session.email, app_log);
                                res.redirect('/confinement/shells/command-sets?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/command-sets?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/command-set-add-command', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.updDocument("command_sets", { name: req.body.command_set} , { $push : { commands: { path: req.body.command_path, access_mode: req.body.access_mode }}})
                        .then(
                            function () {
                                res.redirect('/confinement/shells/command-sets?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/command-sets?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/command-set-delete-command', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.updDocument("command_sets", { name: req.body.command_set} , { $pull : { commands: { path: req.body.command_path, access_mode: req.body.access_mode }}})
                        .then(
                            function () {
                                res.redirect('/confinement/shells/command-sets?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/command-sets?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/command-sets-delete', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var command_sets = req.body.command_sets;
                    if(!(command_sets instanceof Array)){
                        command_sets = command_sets.split();
                    }

                    p1 = command_sets.map(function(el){
                        return mdb.delDocument("command_sets", {name: el})
                    });
                    p2 = mdb.updManyDocuments("confinement_shells", {} , { $pull : { command_sets: {$in : command_sets }}})

                    var pAll = [];
                    pAll = p1.concat(p2);
                    Promise.all(pAll)
                        .then(
                            function () {
                                res.redirect('/confinement/shells/command-sets?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/command-sets?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/shell-add', function (req, res, next) {
        enforce = req.body.enforce
        complain = req.body.complain
        disabled = req.body.disabled
        shell = req.body.shell_name.replace(/ /g, "");

        if (!enforce && !complain && !enabled){
            res.redirect('/confinement/shells/management?error=true');
        }
        else {
            mdb.connect(mongo_instance)
                .then(
                    function () {
                        //determine shell mode
                        mode=""
                        if (enforce=="on"){
                            mode="enforce"
                        }
                        else if (complain == "on"){
                            mode="complain"
                        }
                        else {
                            mode="disable"
                        }

                        //transform to array if only one command set is passed
                        req_command_sets = req.body.command_sets;
                        if(!(req_command_sets instanceof Array)){
                            req_command_sets = req_command_sets.split();
                        }

                        mdb.addDocument("confinement_shells", { name: shell, mode: mode, command_sets: req_command_sets})
                            .then(
                                function () {
                                    res.redirect('/confinement/shells/management?error=false');
                                },
                                function (err) {
                                    res.redirect('/confinement/shells/management?error=true');
                                }
                            );
                    },
                    function(err) { errors.mdb_connection_refused(res, err); }
                );
        }
});

router.post('/shell-delete', function (req, res, next) {
    mdb.connect(mongo_instance)
        .then(
            function () {
                shell = req.body.shell;
                mdb.findManyDocuments("users", {loginShell: "/opt/maics/"+shell})
                .then(
                    function(users){
                        p1 = users.map(function(member){
                            return mdb.updDocument("users", {sys_username: member.sys_username},{ $set: {loginShell: "/bin/bash"}})
                        });
                        p2 = users.map(function(member){
                            return ldap.modLoginShell(member.sys_username, "/bin/bash")
                        });
                        p3 = mdb.delDocument("confinement_shells", {name: shell});
                        var pAll = [];
                        pAll = p1.concat(p2, p3);
                        Promise.all(pAll)
                            .then(
                                function () {
                                    res.redirect('/confinement/shells/management?error=false');
                                },
                                function (err) {
                                    res.redirect('/confinement/shells/management?error=true');
                                }
                            );
                    },
                    function (err){ errors.mdb_query_error(res, err); }
                );
            },
            function(err) { errors.mdb_connection_refused(res, err); }
        );
});


router.post('/change-shell-mode', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.updDocument("confinement_shells", { name: req.body.confinement_shell} , { $set : { mode: req.body.mode}})
                        .then(
                            function () {
                                res.redirect('/confinement/shells/management?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/management?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/shell-add-command-set', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.updDocument("confinement_shells", { name: req.body.confinement_shell} , { $push : { command_sets: req.body.command_set}})
                        .then(
                            function () {
                                res.redirect('/confinement/shells/management?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/management?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/shell-delete-command-set', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    mdb.updDocument("confinement_shells", { name: req.body.confinement_shell} , { $pull : { command_sets: req.body.command_set}})
                        .then(
                            function () {
                                res.redirect('/confinement/shells/management?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/management?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/shell-assign-user-add', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    sys_usernames = req.body.sys_username;
                    if(!(sys_usernames instanceof Array)){
                        sys_usernames = sys_usernames.split();
                    }

                    p1 = sys_usernames.map(function(member){
                        return mdb.updDocument("users", {sys_username: member},{ $set: {loginShell: req.body.shell}})
                    });
                    p2 = sys_usernames.map(function(member){
                        return ldap.modLoginShell(member, req.body.shell)
                    });

                    var pAll = [];
                    pAll = p1.concat(p2);
                    Promise.all(pAll)
                        .then(
                            function () {
                                res.redirect('/confinement/shells/assign?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/assign?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/shell-assign-group-add', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    group_name = req.body.group
                    mdb.findDocument("groups", {"name": group_name})
                    .then(
                        function (group){
                            p1 = group.members.map(function(member){
                                return mdb.updDocument("users", {sys_username: member.sys_username},{ $set: {loginShell: req.body.shell}})
                            });
                            p2 = group.members.map(function(member){
                                ldap.modLoginShell(member.sys_username, req.body.shell)
                            });

                            var pAll = [];
                            pAll = p1.concat(p2);
                            Promise.all(pAll)
                                .then(
                                    function () {
                                        res.redirect('/confinement/shells/assign?error=false');
                                    },
                                    function (err) {
                                        res.redirect('/confinement/shells/assign?error=true');
                                    }
                                );

                        },
                        function (err){ errors.mdb_query_error(res, err); }
                    );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

router.post('/shell-assign-user-delete', function (req, res, next) {
        mdb.connect(mongo_instance)
            .then(
                function () {
                    p1 = mdb.updDocument("users", {sys_username: req.body.sys_username},{ $set: {loginShell: "/bin/bash"}})
                    p2 = ldap.modLoginShell(req.body.sys_username, "/bin/bash")
                    Promise.all([p1,p2])
                        .then(
                            function () {
                                res.redirect('/confinement/shells/assign?error=false');
                            },
                            function (err) {
                                res.redirect('/confinement/shells/assign?error=true');
                            }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

module.exports = router;

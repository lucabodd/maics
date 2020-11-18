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
                            function (err) { errors.mdb_query_error(res, err); }
                        );
                },
                function(err) { errors.mdb_connection_refused(res, err); }
            );
});

module.exports = router;

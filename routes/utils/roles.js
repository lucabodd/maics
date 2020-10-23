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
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";



router.get('/update-role', function (req, res, next) {
        var role = req.query.new_role;
        var email = req.query.email;
                mdb.connect(mongo_instance)
                    .then(
                        function () {
                            mdb.updDocument("users", {"email": email}, {$set: { role: role }})
                                .then(
                                    function () {
                                        log("[+] User "+email+" role updated to "+role+" in specified timestamp by: "+req.session.email+" from "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'), journal_log);
                                        log("[+] User "+email+" role updated by: "+req.session.email, app_log);
                                        res.redirect('/users/roles?error=false');
                                    },
                                    function (err) {
                                        log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err.message, app_log);
                                        res.redirect('/users/roles?error=true&code=\'DM001\'');
                                    }
                                )
                        },
                        function(err){
                            log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                            res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                        }
                    );
});


module.exports = router;

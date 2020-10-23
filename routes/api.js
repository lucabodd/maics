//Configurations
const config = require('../etc/config.json');

//Web server
var express = require('express');
var app = express();
var session = require('express-session');
var router = express.Router();

//MongoDB
var DB = require("../modules/db");
var mdb = new DB(config.mongo.url);
var mongo_instance = config.mongo.instance

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"

//example query
//curl 'http://10.60.0.24:3000/api/host-add?hostname=hqit-demetra-01&ip=10.60.0.47&port=22&cluster=HQIT&proxy=none'

router.get('/host-add', function (req, res, next) {
    var document = {
        hostname: req.query.hostname,
        ip: req.query.ip,
        port: req.query.port,
        cluster: req.query.cluster,
        proxy: req.query.proxy
    };

    mdb.connect(mongo_instance)
        .then(
            function () {
                var addU = mdb.addDocument("hosts", document);
                var addG = mdb.updDocument("clusters", {name: req.query.cluster}, {$push: {members: document}});
                Promise.all([addU, addG])
                    .then(
                        function () {
                            log('[+] Host '+document.hostname+' Successfully added via API, client ip: '+req.ip.replace(/f/g, "").replace(/:/g, ""),app_log);
                            res.sendStatus(200);
                        },
                        function (err) {
                            log('[-] Error occurred while adding host '+document.hostname+' via API, client ip: '+req.ip.replace(/f/g, "").replace(/:/g, "")+' reason: '+err.message,app_log);
                            res.sendStatus(500);
                        })
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.sendStatus(500);
            });
});

/***************************************
 *          GROUP MANAGEMENT - END     *
 ***************************************/
module.exports = router;

//Configurations
const config = require('../etc/config.json');
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log";
const journal_log = config.maics.log_dir+"journal.log";

function Errors(){};

Errors.prototype.mdb_connection_refused = function (res, err){
    log('[-] Connection to MongoDB cannot be established, reason: '+err, app_log);
    res.render('error-500',{message: "error-500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
}

Errors.prototype.mdb_query_error = function (res, err){
    log('[-] Connection to MongoDB has been established, but no query can be performed, reason: '+err, app_log);
    res.render('error-500',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
}

module.exports = Errors;

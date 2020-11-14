
function error_mdb_connection_refused(err){
    log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
    res.render('error',{message: "error-500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
}

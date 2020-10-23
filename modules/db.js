//Configurations
const config = require('../etc/config.json');

//logging
const log = require('log-to-file');
const db_log = config.maics.log_dir+"mongodb.log";

// Implements CRUD operations with mongodb
var MongoClient = require('mongodb').MongoClient;

function DB(uri) {
	this.db = null;			// The MongoDB database connection
	this.client = null;
	this.uri = uri;
}
DB.prototype.connect = function (mongo_instance) {
    var _this = this;       // Required as `this` is no longer available in the functions invoked
    return new Promise(function(resolve, reject){
        if(_this.db) {
            log("[+] Socket not opened, reusing a previously opened one. Connected to DB",db_log);
            resolve();
        }
        else{
            var __this = _this;
            MongoClient.connect(__this.uri, { useUnifiedTopology: true })
                .then(
                    function (database) {
						__this.client = database;
                        __this.db = database.db(mongo_instance);
                        log("[+] Socket opened: Connected to DB",db_log);
                        resolve();
                    },
                    function(err){
                        log("[-] Error establishing a database connection, reason: "+err.message,db_log);
                        reject(err.message);
                    }
                )
        }
    })
}

DB.prototype.addDocument = function (coll, document){
    var _this = this;
    return new Promise(function(resolve, reject) {
        _this.db.collection(coll, function (error, collection) {
            if (error){
                log("[-] Could not connect to "+ coll +", reason: "+error.message,db_log);
                reject(error.message);
            }
            else {
                collection.insertOne(document)
                    .then(
                        function (result) {
                            log("[+] Document inserted correctly into collection, exited with."+result,db_log);
                            resolve();
                        },
                        function(err) {
                            log("[-] Error in document insert. error: "+err.message,db_log);
                            reject(err.message);
                        })
            }
        })
    });
}
DB.prototype.close = function () {
    if(this.client){
		var _this = this
        this.client.close()
            .then(
                function(){
					_this.db = null;
					_this.client = null;
		    		log("[+] Connection to DB closed ", db_log);
				},
                function (err) {
                    log("[-] failed to close db connection, reason:"+err.message, db_log);
                }
            )
    }
}
DB.prototype.delDocument = function(coll, pattern) {
    var _this = this;
    return new Promise(function (resolve, reject){
        _this.db.collection(coll, function (error, collection) {
            if(error){
                log("[-] Could not connect to "+ coll +", reason: "+error.message,db_log);
                reject(error.message);
            }
            else {
                collection.deleteOne(pattern)
                    .then(
                        function (result){
                            if(JSON.parse(result).n == 0)
                                log("[*] Nothing to remove can be found as matching the pattern: "+pattern,db_log);
                            else
                                log("[+] Succesfully removed "+ JSON.parse(result).n + " documents",db_log);
                            resolve();
                        },
                        function(err){
                            log("[-] Error in document remove, reason: "+err.message,db_log);
                            reject();
                        })
            }
        })
    })
}

DB.prototype.delManyDocuments = function(coll, pattern) {
    var _this = this;
    return new Promise(function (resolve, reject){
        _this.db.collection(coll, function (error, collection) {
            if(error){
                log("[-] Could not connect to "+ coll +", reason: "+error.message,db_log);
                reject(error.message);
            }
            else {
                collection.deleteMany(pattern)
                    .then(
                        function (result){
                            if(JSON.parse(result).n == 0)
                                log("[*] Nothing to remove can be found as matching the pattern: "+pattern,db_log);
                            else
                                log("[+] Succesfully removed "+ JSON.parse(result).n + " documents",db_log);
                            resolve();
                        },
                        function(err){
                            log("[-] Error in document remove, reason: "+err.message,db_log);
                            reject();
                        })
            }
        })
    })
}

DB.prototype.updDocument = function(coll, match, update){
    var _this = this;
    return new Promise(function(resolve, reject){
        _this.db.collection(coll, function (error, collection){
            if(error){
                log("[-] Could not connect to "+ coll +" error: "+error.message,db_log);
                reject(error.message);
            }
            else {
                collection.updateOne(match,update)
                    .then(
                        function (result) {
                            if (JSON.parse(result).nModified == 0)
                                log("[*] Nothing to update can be found as matching the pattern: "+match,db_log);
                            else
                                log("[+] Succesfully update one document",db_log);
                            resolve(result);
                        },
                        function (err) {
                            log("[-] Error in document update, reason: "+err.message,db_log);
                            reject(err);
                        }
                    )
            }
        })
    })
}
DB.prototype.updManyDocuments = function(coll, match, update){
    var _this = this;
    return new Promise(function(resolve, reject){
        _this.db.collection(coll, function (error, collection){
            if(error){
                log("[-] Could not connect to "+ coll +", reason: "+error.message,db_log);
                reject(error.message);
            }
            else {
                collection.updateMany(match,update)
                    .then(
                        function (result) {
                            log("[+] Succesfuly updated "+JSON.parse(result).nModified+" documents",db_log);
                            resolve();
                        },
                        function (err) {
                            log("[-] Error in document remove, reason: "+err.message,db_log);
                            reject();
                        }
                    )
            }
        })
    })
}
DB.prototype.findManyDocuments = function(coll, match,att){
    if(att==undefined)
    {
        att = {};
    }
    var _this = this;
    return new Promise(function (resolve, reject){
        _this.db.collection(coll, function (error, collection){
            if(error){
                log("[-] Could not connect to "+ coll +", reason: "+error.message,db_log);
                reject(error.message);
            }
            else{
                var cursor = collection.find(match, {projection: att});
                cursor.toArray(function(error, res) {
                    if (error) {
                        log("[-] Error reading from cursor: " + error.message,db_log);
                        reject(error.message);
                    } else {
                        resolve(res);
                    }
                })
            }
        })
    })
};
DB.prototype.findDocument = function(coll, match,att){
    if(att==undefined)
    {
        att = {};
    }
    var _this = this;
    return new Promise(function (resolve, reject){
        _this.db.collection(coll, function (error, collection){
            if(error){
                log("[-] Could not connect to "+ coll +", reason: "+error.message,db_log);
                reject(error.message);
            }
            else{
                var cursor = collection.findOne(match, {projection:att} ,function(error, res) {
                    if (error) {
                        log("[-] Error reading fron cursor: " + error.message,db_log);
                        reject(error.message);
                    } else {
                        resolve(res);
                    }
                })
            }
        })
    })
};
DB.prototype.selectDistinct = function(coll, field){
    var _this = this
    return new Promise(function (resolve, reject) {
        _this.db.collection(coll, function(err, res){
            if(err){
                log("[-] Could not connect to "+ coll +" error: "+error.message,db_log);
                reject(error.message);
            }
            else {
                var dataset = collection.distinct(field, function(err,res){
                   if(err){
                       log("[-] Error reading fron cursor: " + error.message,db_log);
                   }
                   else{
                       resolve(res);
                   }
                });
            }
        })

    })
};
DB.prototype.countCollectionItems = function(coll){
    var _this = this;

    return new Promise(function (resolve, reject){

        // {strict:true} means that the count operation will fail if the collection
        // doesn't yet exist

        _this.db.collection(coll, {strict:true}, function(error, collection){
            if (error) {
                log("Could not access collection: " + error.message,db_log);
                reject(error.message);
            } else {
                collection.countDocuments()
                    .then(
                        function(count) {
                            // Resolve the promise with the count
                            resolve(count);
                        },
                        function(err) {
                            log("countDocuments failed: " + err.message,db_log);
                            // Reject the promise with the error passed back by the count
                            // function
                            reject(err.message);
                        }
                    )
            }
        });
    })
};
module.exports = DB;

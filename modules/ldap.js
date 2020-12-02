//Configurations
const config = require('../etc/config.json');

//logging
const log = require('log-to-file');
const ldap_log = config.maics.log_dir+"ldap.log";

//Base module extended in this class
var ldap = require('ldapjs');

//FS to read ldap certs
var fs = require('fs');

//required for the unbind (may be removed in future)
var assert = require('assert');

//async function for password generation
const { promisify } = require('util');
const exec = promisify(require('child_process').exec)

//random string generation
var randomstring = require("randomstring");


function LDAP(configObj){
    this.clientOptions = {
        url: configObj.uri,
        tlsOptions: {
            'ca': fs.readFileSync(configObj.TLS.CA)
            //'key': fs.readFileSync(configObj.TLS.KEY),
            //'cert': fs.readFileSync(configObj.TLS.CERT)
        }
    };
    this.ldap_base_dn = configObj.base_dn;
    this.ldap_base_users = "ou="+configObj.users_ou+","+configObj.base_dn;
    this.ldap_base_groups = "ou="+configObj.groups_ou+","+configObj.base_dn;
    this.ldap_bind_username = configObj.bind_dn;
    this.ldap_bind_password = configObj.bind_password;
}


LDAP.prototype.auth = function(uid, pwd)
{
    var _this = this;
    return new Promise(function (resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind("uid="+uid+","+_this.ldap_base_users, pwd, function(err) {
            if(err){
                log("[-] cannot auth user, reason: "+err.message,ldap_log);
                reject(err);
            }
            else{
                log("[+] User "+uid+" authed",ldap_log);
                resolve();
            }
        });
    });
}

LDAP.prototype.search = function(srcOpt)
{
    var _this = this;
    return new Promise(function (resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var base = _this.ldap_base_users;
                var entries = [];
                client.search(base, srcOpt, function (err, res) {
                    if (err)
                    {
                        log('[-] Error occurred while ldap search, reason:'+ err.message,ldap_log);
                        reject();
                    }
                    else
                    {
                        res.on('searchEntry', function (entry) {
                            var r = entry.object;
                            entries.push(r);
                        });
                        res.on('end', function (result) {
                            resolve(entries);
                        });
                    }
                });
            }
        });
    });
}

LDAP.prototype.searchGroup = function(srcOpt)
{
    var _this = this;
    return new Promise(function (resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var base = _this.ldap_base_groups;
                var entries = [];
                client.search(base, srcOpt, function (err, res) {
                    if (err)
                    {
                        log('[-] Error occurred while ldap search, reason:'+ err.message,ldap_log);
                        reject();
                    }
                    else
                    {
                        res.on('searchEntry', function (entry) {
                            var r = entry.object;
                            entries.push(r);
                        });
                        res.on('end', function (result) {
                            resolve(entries);
                        });
                    }
                });
            }
        });
    });
}

LDAP.prototype.modKey = function (uid, sshPublicKey)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var change = new ldap.Change({
                    operation: 'replace',
                    modification: {
                        sshPublicKey: sshPublicKey
                    }
                });
                client.modify("uid="+uid+","+_this.ldap_base_users, change,function(err) {
                    if(err){
                        log('[-] Error occurred while modifing '+ err.message,ldap_log);
                        reject(err);
                    }
                    else{
                        log('[+] User key modified',ldap_log);
                        resolve();
                    }
                });
            }
        });
    });
}

LDAP.prototype.modLoginShell = function (uid, shell)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var change = new ldap.Change({
                    operation: 'replace',
                    modification: {
                        loginShell: shell
                    }
                });
                client.modify("uid="+uid+","+_this.ldap_base_users, change,function(err) {
                    if(err){
                        log('[-] Error occurred while modifing '+ err.message,ldap_log);
                        reject(err);
                    }
                    else{
                        log('[+] User loginShell modified',ldap_log);
                        resolve();
                    }
                });
            }
        });
    });
}

LDAP.prototype.lockAccount = function (uid)
{
    var now = new Date();
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var change = new ldap.Change({
                    operation: 'add',
                    modification: {
                        pwdAccountLockedTime: now.toISOString().replace(/-/g,"").replace("T","").replace(/:/g,"").slice(0,-5)+"Z"
                    }
                });
                client.modify("uid="+uid+","+_this.ldap_base_users, change,function(err) {
                    if(err){
                        log('[-] Error occurred while modifing '+ err.message,ldap_log);
                        reject(err);
                    }
                    else{
                        log('[+] User key modified',ldap_log);
                        resolve();
                    }
                });
            }
        });
    });
}

LDAP.prototype.unlockAccount = function (uid)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var change = new ldap.Change({
                    operation: 'delete',
                    modification: {
                        pwdAccountLockedTime: []
                    }
                });
                client.modify("uid="+uid+","+_this.ldap_base_users, change,function(err) {
                    if(err){
                        log('[-] Error occurred while modifing '+ err.message,ldap_log);
                        reject(err);
                    }
                    else{
                        log('[+] User key modified',ldap_log);
                        resolve();
                    }
                });
            }
        });
    });
}

LDAP.prototype.modPwd = function (uid, pwd)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                _this.genLdapHashes(pwd)
                .then(
                    function(hashes){
                        var change = new ldap.Change({
                            operation: 'replace',
                            modification: {
                                userPassword: hashes.ldap,
                            }
                        });
                        client.modify("uid="+uid+","+_this.ldap_base_users, change,function(err) {
                            if(err){
                                reject(err);
                            }
                            else{
                                resolve();
                            }
                        });

                    },
                    function(err){
                        log("[-] unable to genearte LDAP hashes reason:"+err,ldap_log);
                    }
                );
            }
        });
    });
}


LDAP.prototype.delUser = function (uid)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                //delete user
                client.del("uid="+uid+","+_this.ldap_base_users,function(err){
                    if(err){
                        reject(err);
                    }
                    else
                    {
                        //delete user persoal default group
                        client.del("cn="+uid+","+_this.ldap_base_groups,function(err){
                            if(err){
                                reject(err);
                            }
                            else
                            {
                                //delete user from non-personal groups
                                _this.searchGroup({ scope: 'sub', filter: '(memberUid='+uid+')', attributes: ['cn','memberUid']})
                                .then(
                                    function(res){
                                        if(res.length == 0){
                                            resolve();
                                        }
                                        else {
                                            res.forEach(function(element){
                                                _this.delUserFromGroup(uid, element.cn)
                                            });
                                            resolve();
                                        }
                                    },
                                    function(err){
                                        log("[-] Cannot search in ldap, reason: "+err, ldap_log);
                                    }
                                );
                            }
                        });
                        resolve();
                    }
                });
            };
        });
    });
}

LDAP.prototype.getUserGroups = function (uid)
{
    var _this = this
    return new Promise(function(resolve, reject){
        _this.searchGroup({ scope: 'sub', filter: '(memberUid='+uid+')', attributes: ['cn']})
            .then(
                function(res){
                    var group_list;
                    group_list = res.map(function(element){
                        return element.cn;
                    });
                    group_list = group_list.filter(function(element){
                        if(element != uid){
                            return element;
                        }
                    });

                    if(group_list.length == 0)
                        resolve(["none"]);
                    else
                        resolve(group_list);
                },
                function(err){
                    log("[-] Cannot search in ldap, reason: "+err, ldap_log);
                        reject();
                }
        );
    });
}


LDAP.prototype.addUser = function (uid, domain, password, sshPublicKey)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                //max_uid and max_gid interrogation
                _this.search({ scope: 'sub', filter: '(uidNumber=*)', attributes: ['uidNumber', 'gidNumber']})
                .then(
                    function(res){
                        //incrementing uid and gid for new user
                        //init uidNumber
                        if(res.length == 0){
                            max_uid = 1000;
                            max_gid = 1000;
                        }
                        //otherwise increment last retriven uid
                        else {
                            //domain is > 0
                            max_uid = -1;
                            max_gid = -1;
                            res.forEach(function(element){
                                el_uid = parseInt(element.uidNumber)
                                el_gid = parseInt(element.gidNumber)
                                if( el_uid > max_uid){
                                    max_uid = el_uid;
                                }
                                if(el_gid > max_gid){
                                    max_gid = el_gid;
                                }
                            });
                            max_uid += 1;
                            max_gid += 1;
                        }

                        _this.genLdapHashes(password)
                        .then(
                            function(hashes){
                                var user = {
                                    objectClass: ["top",
                                    "person",
                                    "posixAccount",
                                    "shadowAccount",
                                    "inetOrgPerson",
                                    "organizationalPerson",
                                    "ldapPublicKey"],
                                    loginShell: "/bin/bash",
                                    homeDirectory: "/home/"+uid,
                                    uid: uid,
                                    cn: uid,
                                    sn: uid,
                                    uidNumber: max_uid,
                                    gidNumber: max_gid,
                                    mail: uid+"@"+domain,
                                    userPassword: hashes.ldap,
                                    sshPublicKey: sshPublicKey
                                };
                                var group = {
                                    memberUid: uid,
                                    gidNumber: max_gid,
                                    objectClass: ["top",
                                    "posixGroup"],
                                    cn: uid
                                };
                                fullU = "uid="+uid+","+_this.ldap_base_users;
                                fullG = "cn="+uid+","+_this.ldap_base_groups;
                                //add user via LDAP
                                client.add(fullU, user,function(err){
                                    if(err){
                                        reject(err);
                                    }
                                    else
                                    {
                                        //add group
                                        client.add(fullG, group,function(err){
                                            if(err){
                                                reject(err);
                                            }
                                            else
                                            {
                                                resolve();
                                            }
                                        });
                                    }
                                });
                            },
                            function(err){
                                log("[-] Cannot generate hashes, reason: "+err,ldap_log);
                            }
                        );
                    },
                    function(err){
                        log("[-] Cannot search in ldap, reason: "+err,ldap_log);
                    }
                );
            }
        });
    });
}

LDAP.prototype.addGroup = function (gid)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                //max_uid and max_gid interrogation
                _this.searchGroup({ scope: 'sub', filter: '(cn=*)', attributes: ['gidNumber']})
                .then(
                    function(res){
                        //init uidNumber
                        if(res.length == 0){
                            max_gid = 1000;
                        }
                        //otherwise increment last retriven uid
                        else {
                            //domain is > 0
                            max_gid = -1;
                            res.forEach(function(element){
                                el_gid = parseInt(element.gidNumber)
                                if(el_gid > max_gid){
                                    max_gid = el_gid;
                                }
                            });
                            //assign higher gid to "non-persoal default group"
                            if (max_gid < 45000){ //means that user have not defined a custom group
                                max_gid = 44999;
                            }
                            max_gid += 1;


                            var group = {
                                gidNumber: max_gid,
                                objectClass: ["top",
                                "posixGroup"],
                                cn: gid
                            };
                            fullG = "cn="+gid+","+_this.ldap_base_groups;

                            client.add(fullG, group,function(err){
                                if(err){
                                    reject(err);
                                }
                                else
                                {
                                    resolve();
                                }
                            });
                        }
                    },
                    function(err){
                        log("[-] Cannot search in ldap, reason: "+err,ldap_log);
                    }
                );
            }
        });
    });
}

LDAP.prototype.delGroup = function (gid)
{
    var _this = this;
    return new Promise(function(resolve, reject){
            client = ldap.createClient(_this.clientOptions);
            client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
                if (err)
                {
                    log('[-] Error occurred while binding'+ err.message,ldap_log);
                    reject();
                }
                else
                {
                    //delete user

                    client.del("cn="+gid+","+_this.ldap_base_groups,function(err){
                        if(err){
                            reject(err);
                        }
                        else
                        {
                            resolve();
                        }
                    });
                }
            });

    });
}

LDAP.prototype.addUserToGroup = function (uid, gid)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var change = new ldap.Change({
                    operation: 'add',
                    modification: {
                        memberUid: uid
                    }
                });
                client.modify("cn="+gid+","+_this.ldap_base_groups, change,function(err) {
                    if(err){
                        log('[-] Error occurred while modifing '+ err.message,ldap_log);
                        reject(err);
                    }
                    else{
                        log('[+] User added to group',ldap_log);
                        resolve();
                    }
                });
            }
        });
    });
}

LDAP.prototype.delUserFromGroup = function (uid, gid)
{
    var _this = this
    return new Promise(function(resolve, reject){
        client = ldap.createClient(_this.clientOptions);
        client.bind(_this.ldap_bind_username, _this.ldap_bind_password, function(err) {
            if (err)
            {
                log('[-] Error occurred while binding'+ err.message,ldap_log);
                reject();
            }
            else
            {
                var change = new ldap.Change({
                    operation: 'delete',
                    modification: {
                        memberUid: uid
                    }
                });
                client.modify("cn="+gid+","+_this.ldap_base_groups, change,function(err) {
                    if(err){
                        log('[-] Error occurred while modifing '+ err.message,ldap_log);
                        reject(err);
                    }
                    else{
                        log('[+] User deleted from group',ldap_log);
                        resolve();
                    }
                });
            }
        });
    });
}




LDAP.prototype.genLdapHashes = async function(pwd){
    var ldap = await exec("/usr/sbin/slappasswd -h '{SSHA512}' -o module-load=pw-sha2.la -o module-path=/usr/lib/ldap -s "+pwd);
    var samba = await exec("printf '%s' '"+pwd+"' | iconv -t utf16le | openssl md4|awk '{print $2}'");
    ldap = ldap.stdout.trim();
    samba = samba.stdout.trim()
    return {ldap, samba};
}
LDAP.prototype.unbind = function()
{
    var _this = this;
    client = ldap.createClient(_this.clientOptions);
    client.unbind(function(err){
        if(err){
            log('[-] Error disconnecting from LDAP, reason: '+err,ldap_log)
        }
        else{
            log('[+] Client closed connection with ldap',ldap_log)
        }
    });
}

module.exports = LDAP;

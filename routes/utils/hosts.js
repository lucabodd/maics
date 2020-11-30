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

//process spawning
const exec = require('child_process').exec

//ansible
const maics_dir = config.maics.dir
const maics_user = config.maics.user

router.post('/host-add', function (req, res, next) {
    var req_hostgroups = req.body.hostgroups;
    if(!( req_hostgroups instanceof Array)){
        req_hostgroups = req_hostgroups.split();
    }
    var document = {
        hostname: req.body.hostname,
        ip: req.body.ip,
        port: req.body.port,
        hostgroups: req_hostgroups.join(" "),
        proxy: req.body.proxy,
        connection: "unreachable",
        connection_detail: "Pending connection ..." //detail of connection error - string is base64 encoded
    };

    mdb.connect(mongo_instance)
        .then(
            function () {
                var addU = mdb.addDocument("hosts", document);
                delete document.hostgroups;
                addClusters = req_hostgroups.map(function(c){
                    return mdb.updDocument("hostgroups", {name: c}, {$push: {members: document}});
                })
                //merge all promises
                var pAll = [];
                pAll = addClusters.concat(addU)
                Promise.all(pAll)
                    .then(
                        function () {
                            log('[+] Host '+document.hostname+' Successfully added from user : '+req.session.email, app_log);
                            res.redirect('/hosts/management?error=false');
                        },
                        function (err) {
                            log('[-] Connection to MongoDB has been established, but no query cannot be satisfied, reason: '+err.message, app_log);
                            res.redirect('/hosts/management?error=true&code=\'DM001\'');
                        })
            },
            function (err) {
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
            });
});


/* Exec ansible playbook in order to deploy maics client to selected host */
router.get('/host-cli-deploy', function (req, res, next) {
        var host = req.query.hostname;
        mdb.connect(mongo_instance)
        .then(
            function(){
                mdb.updDocument("hosts", {hostname: host}, {$set: {deploy_req: "SYN", connection: "deploy-req", connection_detail: "Deploying maics-ward. Please wait ..." }})
                .then(
                    function(){
                        log('[+] User '+req.session.email+' requested client deploy for host'+host, app_log);
                        res.redirect('/hosts/management?error=false');
                    },
                    function(err){
                        log('[-] Connection to MongoDB has been established, but no query cannot be satisfied, reason: '+err.message, app_log);
                        res.redirect('/hosts/management?error=true&code=\'DM001\'');
                    }
                )
            },
            function(err){
                log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
            }
        )
});
/* GET host-delete
 * add new user in DB
 * This method generate ssh key-pair and update user entry
 */
router.get('/host-delete', function (req, res, next) {
        var host = req.query.hostname;
        mdb.connect(mongo_instance)
            .then(
                function () {
                    var p1 = mdb.delDocument("hosts", {"hostname": host});
                    var p2 = mdb.updManyDocuments("hostgroups", {},  {$pull : { "members" : {"hostname" : host}}});
                    var p3 = mdb.delDocument("access", {"hostname" : host});
                    Promise.all([p1, p2, p3])
                        .then(
                            function () {
                                log('[+] Host '+host+' Successfully deleted from user : '+req.session.email, app_log);
                                res.redirect('/hosts/management?error=false');
                            },
                            function (err) {
                                log('[-] Connection to MongoDB has been established, but no query cannot be satisfied, reason: '+err.message, app_log);
                                res.redirect('/hosts/management?error=true&code=\'DM001\'');
                            }
                        )
                }
            )
});

router.post('/deploy-ssh-key', function (req, res, next) {
        var username = req.body.username;
        var password = req.body.password;
        var root_password = req.body.root_password;
        var hostname = req.body.hostname;

        //ansible-playbook -i maics-db-01, /var/www/MAICS/ansible/playbooks/ssh-copy-id.yml -u root -e 'ansible_ssh_pass="Nab2Blim!"'
        //ansible-playbook -i maics-db-01, /var/www/MAICS/ansible/playbooks/ssh-copy-id.yml -u itadm -e 'ansible_ssh_pass="Oncealib3$" ansible_become_pass="Nab2Blim!" su=true'
        //ansible-playbook -i maics-db-01, /var/www/MAICS/ansible/playbooks/ssh-copy-id.yml -u itadm -e 'ansible_ssh_pass="Oncealib3$" sudo=true'

        base_command="export ANSIBLE_HOST_KEY_CHECKING=False; ansible-playbook -i "+hostname+", "+maics_dir+"ansible/playbooks/ssh-copy-id.yml -u ";
        //auth with su
        if(username!="" && password!="" && root_password!=""){
            command = base_command+username+" -e 'maics_user=\""+maics_user+"\" ansible_ssh_pass=\""+password+"\" ansible_become_pass=\""+root_password+"\" su=true'"
        }
        //auth with sudo
        else if (username!="" && password!=""){
            command = base_command+username+" -e 'maics_user=\""+maics_user+"\" ansible_ssh_pass=\""+password+"\" sudo=true'"

        }
        //auth as root
        else if (root_password!=""){
            command = base_command+"root -e 'maics_user=\""+maics_user+"\" ansible_ssh_pass=\""+root_password+"\"'"
        }
        else{
            res.redirect('/hosts/management?error=true&code=\'DM001\'');
        }
        exec(command, (error, stdout, stderr) => {
            if (error || stderr) {
                console.log(`error: ${error.message}`);
                res.redirect('/hosts/management?error=true&code=\'DM001\'');
            }
            else {
                mdb.connect(mongo_instance)
                .then(
                    function(){
                        mdb.updDocument("hosts", {hostname: hostname}, {$set: {connection: "login-check", connection_detail: "Logging in, please refresh page in a while ..." }})
                        .then(
                            function(){
                                log('[+] User '+req.session.email+' requested client deploy for host'+hostname, app_log);
                                res.redirect('/hosts/management?error=false');
                            },
                            function(err){
                                log('[-] Connection to MongoDB has been established, but no query cannot be satisfied, reason: '+err.message, app_log);
                                res.redirect('/hosts/management?error=true&code=\'DM001\'');
                            }
                        )
                    },
                    function(err){
                        log('[-] Connection to MongoDB cannot be established, reason: '+err.message, app_log);
                        res.render('error',{message: "500",  error : { status: "Service unavailable", detail : "The service you requested is temporary unvailable" }});
                    }
                )
                res.redirect('/hosts/management?error=false');
            }
        });

});


/***************************************
 *          GROUP MANAGEMENT - END     *
 ***************************************/

 module.exports = router;

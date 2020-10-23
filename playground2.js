//Configurations
const config = require('./etc/config.json');
//LDAP
var LDAP = require("./modules/ldap");
var ldap = new LDAP(config.ldap);


uid="luca.bodini"
p1 =ldap.addGroup("Developers")
p2 =ldap.addGroup("Administrators")

Promise.all([p1,p2])
  .then(
      function(ldap_rset){
          console.log(ldap_rset)
      },
      function(err){
          console.log(err)
      }
 );

/*
console.log("SEARCHGRP")
 ldap.searchGrp({ scope: 'sub', filter: '(cn=*)', attributes: ['gidNumber']})
   .then(
       function(ldap_rset){
           console.log(ldap_rset)
       },
       function(err){
           console.log(err)
       }
  );
*/

//Configurations
const config = require('./etc/config.json');
//LDAP
var LDAP = require("./modules/ldap");
var ldap = new LDAP(config.ldap);
var ldap2 = new LDAP(config.ldap);


uid="luca.bodini"
ldap.getUserGroups(uid).then(
    function(res){console.log(res)}
);

p2 = ldap.delGroup("Administrators")
p1 = ldap2.delGroup("Developers")

Promise.all([p1, p2])
  .then(
      function(ldap_rset){
          console.log(ldap_rset)
      },
      function(err){
          console.log(err)
      }
 )
 .catch(function(err) {
               // log that I have an error, return the entire array;
               console.log('A promise failed to resolve', err);
               return arrayOfPromises;
           });

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

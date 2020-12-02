var UTILS = require("./modules/utils");
var utils = new UTILS();

var sshpk = require('sshpk');

var fs = require('fs');

/* Read in an OpenSSH/PEM *private* key */
var keyPriv = fs.readFileSync('/etc/ssh/ssh_host_ecdsa_key');
var key = sshpk.parsePrivateKey(keyPriv, 'pem');

var data = 'asdfert';

/* Sign some data with the key */
var s = key.createSign('sha1');
s.update(data);
var signature = s.sign();

/* Now load the public key (could also use just key.toPublic()) */
//var keyPub = fs.readFileSync('/etc/ssh/ssh_host_ecdsa_key.pub');
//console.log(keyPub)
keyPubStr = "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBM0ObqgLyX+IRkpclBq7FiknDohMyvu5hyhZjVqrHGbdoYiY1x7nmb44IwnobHnRgdEVff308IwiyBCbUmRcRoM= root@maics-appliance-01"
keyPub = Buffer.from(keyPubStr, 'utf8');
key = sshpk.parseKey(keyPub, 'ssh');
buf = "MEQCIFaXUWVQJjrxICmI0+Hru0u8nTTPQJwPayoK8qraEWzfAiB2wABU8p0SwJgjnjKGiWj/A/GlnZmoU7A79Hb/VTmCwg=="
tmp = sshpk.parseSignature(buf, "ecdsa", "asn1")
console.log(tmp)

/* Make a crypto.Verifier with this key */
var v = key.createVerify('sha256');
v.update(data);
var valid = v.verify(tmp);
console.log(valid)
/* => true! */


console.log(utils.hashsum(["maics01","maics02"]))

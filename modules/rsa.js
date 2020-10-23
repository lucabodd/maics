var crypto = require("crypto");
var path = require("path");
var fs = require("fs");

function RSA(){};

RSA.prototype.RSAencrypt = function(toEncrypt, key) {
    var absolutePath = key;
    var publicKey = fs.readFileSync(absolutePath, "utf8");
    var toEncrypt1 = toEncrypt.slice(0,240);
    var toEncrypt2 = toEncrypt.slice(240, toEncrypt.length);
    var buffer1 = Buffer.from(toEncrypt1);
    var buffer2 = Buffer.from(toEncrypt2);
    var encrypted1 = crypto.publicEncrypt(publicKey, buffer1);
    var encrypted2 = crypto.publicEncrypt(publicKey, buffer2);
    return encrypted1.toString("base64")+"|"+encrypted2.toString("base64");
};

RSA.prototype.RSAdecrypt = function(toDecrypt, relativeOrAbsolutePathtoPrivateKey) {
    var absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey);
    var privateKey = fs.readFileSync(absolutePath, "utf8");
    var toDecrypt1 = toDecrypt.split("|")[0];
    var toDecrypt2 = toDecrypt.split("|")[1];
    var buffer1 = Buffer.from(toDecrypt1, "base64");
    var buffer2 = Buffer.from(toDecrypt2, "base64");
    var decrypted1 = crypto.privateDecrypt(privateKey, buffer1);
    var decrypted2 = crypto.privateDecrypt(privateKey, buffer2);
    return decrypted1.toString("utf8")+decrypted2.toString("utf8");
};

module.exports = RSA;

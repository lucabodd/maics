function UTILS(){};

//crypt SHA-512
var crypto = require('crypto');


UTILS.prototype.hashsum = function(hosts){
    hosts.unshift("_________000___000___hashroot___000___000_________")
    hashsum = ""
    hosts.sort()
    for (i = 0; i < hosts.length; i++) {
        var hash = crypto.createHash('sha512');
        data = hash.update(hashsum+hosts[i], 'utf-8');
        hashsum = data.digest('hex');
    }

    //remove hashroot from array
    hosts.shift();

    return hashsum
}

module.exports = UTILS;

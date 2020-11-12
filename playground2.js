var crypto = require('crypto')

var str2="bsd"
var str1="asd"
gen_hash=""

var hash = crypto.createHash('sha512');
data = hash.update(str1+gen_hash, 'utf-8');
gen_hash= data.digest('hex');
console.log(gen_hash)




var hash = crypto.createHash('sha512');
data = hash.update(str2+gen_hash, 'utf-8');
gen_hash= data.digest('hex');
console.log(gen_hash)

const crypto = require('crypto');

const algorithm = 'aes-256-cfb';

function AES_256_CFB(){};

AES_256_CFB.prototype.AESencrypt = function(keyStr, text) {
  const hash = crypto.createHash('sha256');
  hash.update(keyStr);
  const keyBytes = hash.digest();

  const iv = crypto.randomBytes(16);
  var ivstring = iv.toString('hex').slice(0, 16);
  const cipher = crypto.createCipheriv(algorithm, keyBytes, ivstring);
  let enc = [ivstring, cipher.update(text, 'utf8')];
  enc.push(cipher.final());
  return Buffer.concat(enc).toString('base64');
};

AES_256_CFB.prototype.AESdecrypt = function(keyStr, text) {
  const hash = crypto.createHash('sha256');
  hash.update(keyStr);
  const keyBytes = hash.digest();

  const contents = Buffer.from(text, 'base64');
  const iv = contents.slice(0, 16);
  var ivstring = iv.toString('hex').slice(0, 16);
  const textBytes = contents.slice(16);
  const decipher = crypto.createDecipheriv(algorithm, keyBytes, ivstring);
  let res = decipher.update(textBytes, '', 'utf8');
  res += decipher.final('utf8');
  return res;
};

module.exports = AES_256_CFB;

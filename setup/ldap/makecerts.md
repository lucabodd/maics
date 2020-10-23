# Setup SSL certs for LDAP server
the following instructions will guide you trough setting up a ldap cluster in mirror mode over ssl

## Steps
### Create cert dir
``` 
mkdir -p /etc/ssl/openldap/{private,certs,newcerts} 
```

### edit opessl.conf
``` 
vim /usr/lib/ssl/openssl.cnf 
```
and add dir line like
```
...
[ CA_default ]

#dir            = ./demoCA              # Where everything is kept
dir             = /etc/ssl/openldap
certs           = $dir/certs            # Where the issued certs are kept
crl_dir         = $dir/crl              # Where the issued crl are kept
database        = $dir/index.txt        # database index file.
...
```
### Tracking the signed certificates.
```
echo "1001" > /etc/ssl/openldap/serial
touch /etc/ssl/openldap/index.txt
```
### Create a CA Key file by running the command below. 
```
openssl genrsa -aes256 -out /etc/ssl/openldap/private/cakey.pem 2048
openssl rsa -in /etc/ssl/openldap/private/cakey.pem -out /etc/ssl/openldap/private/cakey.pem
```

### Create the CA certificate. Be sure to set the common to match your server FQDN.
```
openssl req -new -x509 -days 3650 -key /etc/ssl/openldap/private/cakey.pem -out /etc/ssl/openldap/certs/cacert.pem
```

### Generate LDAP server key;
```
openssl genrsa -aes256 -out /etc/ssl/openldap/private/ldapserver-key.key 2048
openssl rsa -in /etc/ssl/openldap/private/ldapserver-key.key -out /etc/ssl/openldap/private/ldapserver-key.key
```

### Generate the certificate signing request (CSR). 
Be sure to configure the same details as you did when generating the CA certificate file above. 
```
openssl req -new -key /etc/ssl/openldap/private/ldapserver-key.key -out /etc/ssl/openldap/certs/ldapserver-cert.csr
```

### Generate the LDAP server certificate 
Generate the LDAP server certificate and sign it with CA key and certificate generated above.
```
openssl ca -keyfile /etc/ssl/openldap/private/cakey.pem -cert /etc/ssl/openldap/certs/cacert.pem -in /etc/ssl/openldap/certs/ldapserver-cert.csr -out /etc/ssl/openldap/certs/ldapserver-cert.crt
```

### Verify the LDAP server againt the CA
```
openssl verify -CAfile /etc/ssl/openldap/certs/cacert.pem /etc/ssl/openldap/certs/ldapserver-cert.crt
```

### Set the ownership of the OpenLDAP certificates 
```
chown -R openldap: /etc/ssl/openldap/
```

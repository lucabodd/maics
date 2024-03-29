package main

import (
    "os"
	"fmt"
	"github.com/lucabodd/go-ldap-client"
    "strings"
)

func main() {
    req_user := os.Args[1]

    if(req_user == "root"){
        fmt.Printf("{{ id_rsa_pub.stdout }}")
    } else {
        host := strings.Split("{{ ldap_uri }}", "//")[1]
    	client := &ldap.LDAPClient{
    		Base:         "{{ ldap_base_dn }}",
    		Host:         host,
    		Port:         636,
    		UseSSL:       true,
            InsecureSkipVerify: true,
    		BindDN:       "{{ ldap_read_only_dn }}",
    		BindPassword: "{{ ldap_read_only_password }}",
    		UserFilter:   "(uid=%s)",
    		GroupFilter: "(memberUid=%s)",
    		Attributes:   []string{},
    	}
    	// It is the responsibility of the caller to close the connection
    	defer client.Close()

        locked, err := client.GetUserAttribute(req_user, "pwdAccountLockedTime")
        if err != nil {
    		fmt.Printf("Error getting pwdAccountLockedTime for user %s: %+v", req_user, err)
    	} else {
            if locked == "" {
                publickey, err := client.GetUserAttribute(req_user, "sshPublicKey")
            	if err != nil {
            		fmt.Printf("Error getting sshPublicKey for user %s: %+v", req_user, err)
            	}
            	fmt.Printf(publickey)
            } else {
                fmt.Println("Permission denied. (Account Locked)")
            }
        }
    }
}

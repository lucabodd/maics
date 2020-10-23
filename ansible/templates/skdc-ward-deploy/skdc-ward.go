package main

import (
    "os"
	"fmt"
	"github.com/lucabodd/go-ldap-client"
)

func main() {
	client := &ldap.LDAPClient{
		Base:         "{{ base }}",
		Host:         "{{ host }}",
		Port:         636,
		UseSSL:       true,
        InsecureSkipVerify: true,
		BindDN:       "{{ bind_dn }}",
		BindPassword: "{{ bind_password }}",
		UserFilter:   "(uid=%s)",
		GroupFilter: "(memberUid=%s)",
		Attributes:   []string{},
	}
	// It is the responsibility of the caller to close the connection
	defer client.Close()


	publickey, err := client.GetUserAttribute(os.Args[1], "sshPublicKey")
	if err != nil {
		fmt.Printf("Error getting groups for user %s: %+v", "username", err)
	}
	fmt.Printf(publickey)
}

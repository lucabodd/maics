package main

import (
	"golang.org/x/crypto/ssh"
	"io/ioutil"
	"log"
	"crypto/ecdsa"
	"crypto/md5"
	"crypto/rand"
	"fmt"
	"hash"
	"io"
	"math/big"
	"os"
)
func main() {
	file, err := ioutil.ReadFile("/etc/ssh/ssh_host_ecdsa_key")
	if err != nil {
		log.Fatal("[-] Can't open config file: ", err)
	}
	privk, err := ssh.ParseRawPrivateKey(file)
	privatekey, _ := privk.(*ecdsa.PrivateKey)

	pubkey := privatekey.Public()
	publickey := pubkey.(*ecdsa.PublicKey)
	fmt.Printf("%+v", publickey)
	fmt.Println(publickey.X)
	fmt.Println(publickey.Y)
	fmt.Println(publickey.Curve)
 	// Sign ecdsa style

 	var h hash.Hash
 	h = md5.New()
 	r := big.NewInt(0)
 	s := big.NewInt(0)

 	io.WriteString(h, "This is a message to be signed and verified by ECDSA!")
 	signhash := h.Sum(nil)

 	r, s, serr := ecdsa.Sign(rand.Reader, privatekey, signhash)
 	if serr != nil {
 		fmt.Println(err)
 		os.Exit(1)
 	}


 	signature := r.Bytes()
 	signature = append(signature, s.Bytes()...)

 	fmt.Printf("Signature : %x\n", signature)

 	// Verify
 	verifystatus := ecdsa.Verify(publickey, signhash, r, s)
 	fmt.Println(verifystatus) // should be true
}

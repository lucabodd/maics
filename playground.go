package main

import (
	"crypto/ecdsa"
	"io/ioutil"
	"crypto/rand"
	"crypto/sha256"
	"golang.org/x/crypto/ssh"
	b64 "encoding/base64"
	"fmt"
)

func main() {
	file, err := ioutil.ReadFile("/etc/ssh/ssh_host_ecdsa_key")
	privk, err := ssh.ParseRawPrivateKey(file)
	privateKey, _ := privk.(*ecdsa.PrivateKey)

	//pubkey := privateKey.Public()
	//publickey := pubkey.(*ecdsa.PublicKey)


	msg := "asdfert"
	hash := sha256.Sum256([]byte(msg))

	sig, err := ecdsa.SignASN1(rand.Reader, privateKey, hash[:])
	if err != nil {
		panic(err)
	}
	fmt.Println(b64.StdEncoding.EncodeToString(sig))

	valid := ecdsa.VerifyASN1(&privateKey.PublicKey, hash[:], sig)
	fmt.Println("signature verified:", valid)
}

/*

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
fmt.Println(signhash)

r, s, serr := ecdsa.SignASN1(rand.Reader, privatekey, signhash)
if serr != nil {
	fmt.Println(err)
	os.Exit(1)
}

fmt.Println("R&S: ")
fmt.Println(r)
fmt.Println(s)

signature := r.Bytes()
signature = append(signature, s.Bytes()...)

fmt.Printf("Signature : %x\n", signature)

// Verify
verifystatus := ecdsa.Verify(publickey, signhash, r, s)
fmt.Println(verifystatus) // should be true


*/

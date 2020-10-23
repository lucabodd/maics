package main

import (
	"fmt"
	"io"
	"encoding/base64"
	"bytes"
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "errors"
    "strings"
	"flag"
	"os"
	"encoding/json"
	"log"
	ldap_client "github.com/lucabodd/go-ldap-client"
)
type Configuration struct {
	Skdc struct {
		Dir     string
		Log_dir string
		Run_dir string
		User	string
		Admin_mail string
	}
	Mongo struct {
		Url 	string
		Instance string
	}
	Ldap struct {
		Uri 	string
		Base_dn string
		Bind_dn string
		Bind_password string
		Read_only_dn string
		Read_only_password string
	}
}
func main() {

	c := flag.String("c", "","Specify the configuration file.")
    flag.Parse()

	file, err := os.Open(*c)
	if err != nil {
		log.Fatal("[-] Can't open config file: ", err)
	}
	defer file.Close()
	decoder := json.NewDecoder(file)
	Config := Configuration{}
	err = decoder.Decode(&Config)

	host := strings.Split(Config.Ldap.Uri, "//")[1]
	ldap := &ldap_client.LDAPClient{
		Base:         Config.Ldap.Base_dn,
		Host:         host,
		Port:         636,
		UseSSL:       true,
		InsecureSkipVerify: true,
		BindDN:       Config.Ldap.Bind_dn,
		BindPassword: Config.Ldap.Bind_password,
		UserFilter:   "(uid=%s)",
		GroupFilter: "(memberUid=%s)",
		Attributes:   []string{},
	}

	groups, err := ldap.GetUserGroups("luca.bodini")
	fmt.Println(groups)
/*
	encKey, err := AESencrypt([]byte("key0123456789asd"), "asd")
	fmt.Println(encKey)
	check(err)
	encKey, err = AESdecrypt([]byte("key0123456789asd"), encKey)
	check(err)
	fmt.Println(encKey)
	*/
}

func AESencrypt(key []byte, message string) (encmess string, err error) {
	plainText := []byte(message)

	block, err := aes.NewCipher(key)
	if err != nil {
		return
	}

	//IV needs to be unique, but doesn't have to be secure.
	//It's common to put it at the beginning of the ciphertext.
	cipherText := make([]byte, aes.BlockSize+len(plainText))
	iv := cipherText[:aes.BlockSize]
	if _, err = io.ReadFull(rand.Reader, iv); err != nil {
		return
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(cipherText[aes.BlockSize:], plainText)

	//returns to base64 encoded string
	encmess = base64.URLEncoding.EncodeToString(cipherText)
	return
}

func AESdecrypt(key []byte, text string) (string, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return "", err
    }

    decodedMsg, err := base64.URLEncoding.DecodeString(addBase64Padding(text))
    if err != nil {
        return "", err
    }

    if (len(decodedMsg) % aes.BlockSize) != 0 {
        return "", errors.New("blocksize must be multipe of decoded message length")
    }

    iv := decodedMsg[:aes.BlockSize]
    msg := decodedMsg[aes.BlockSize:]

    cfb := cipher.NewCFBDecrypter(block, iv)
    cfb.XORKeyStream(msg, msg)

    unpadMsg, err := Unpad(msg)
    if err != nil {
        return "", err
    }

    return string(unpadMsg), nil
}

func Pad(src []byte) []byte {
    padding := aes.BlockSize - len(src)%aes.BlockSize
    padtext := bytes.Repeat([]byte{byte(padding)}, padding)
    return append(src, padtext...)
}

func Unpad(src []byte) ([]byte, error) {
    length := len(src)
    unpadding := int(src[length-1])

    if unpadding > length {
        return nil, errors.New("unpad error. This could happen when incorrect encryption key is used")
    }

    return src[:(length - unpadding)], nil
}
func removeBase64Padding(value string) string {
    return strings.Replace(value, "=", "", -1)
}
func addBase64Padding(value string) string {
    m := len(value) % 4
    if m != 0 {
        value += strings.Repeat("=", 4-m)
    }

    return value
}
func check(e error) {
	if e != nil {
		log.Fatal(e)
		panic(e)
	}
}

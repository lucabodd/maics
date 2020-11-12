package main

import (
	"fmt"
	"io"
	"encoding/base64"
	"bytes"
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
	"crypto/sha256"
    "errors"
    "strings"
	"log"
)
func main() {
	ecn := AESencrypt("55f348eee2396169adc70659b73b8c7ad3543ba45ca3969f06ad3550ec7c17a394f94e00af9f38d1df589777581ac096eb5343f1d4c3ec786ea17fce95385e39",
					  "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCnA/FrULTEx8d73BV3yLVbpGDDIQDukwpz/Mo3wbOvTqGuX0miOhCpS25LGfuyUriURUQfLJmbEbSxbD3Nic5AifglzF2ZJuLCKGh3wmQtm4hAOC4xrjVuAd2YFsSCTk5uc6QHRw4LPILZ2r6EDFVCunWCfaSpKmJuIbdlQ19xHtjX+iOGmHweodvtQhipRs6Ls4J0JcxriYsEcsB67M2kSd3DUlU5mAw9clAG/Uye6ASYCAfhHuj4GdyVvYV/U7u/v18MTgNP06zV/M9knGWHKlrBOGqusQjrdyQZSAico1QbL0MGQyNY7H48joz/M16lkAlDAsbpEMLV2/zbfU77 luca.bodini")

	fmt.Println(ecn)

	dec := AESdecrypt("55f348eee2396169adc70659b73b8c7ad3543ba45ca3969f06ad3550ec7c17a394f94e00af9f38d1df589777581ac096eb5343f1d4c3ec786ea17fce95385e39",
				ecn)
	fmt.Println(dec)
}
//utilityes
/***************************************
	AES encryption
****************************************/
func AESencrypt(keyStr string, cryptoText string) string {
	keyBytes := sha256.Sum256([]byte(keyStr))
	return encrypt(keyBytes[:], cryptoText)
}

// encrypt string to base64 crypto using AES
func encrypt(key []byte, text string) string {
	plaintext := []byte(text)

	block, err := aes.NewCipher(key)
	Check(err)

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, aes.BlockSize+len(plaintext))
	iv := ciphertext[:aes.BlockSize]
	_, err = io.ReadFull(rand.Reader, iv)
	Check(err)

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], plaintext)

	return base64.StdEncoding.EncodeToString(ciphertext)
}

func AESdecrypt(keyStr string, cryptoText string) string {
	keyBytes := sha256.Sum256([]byte(keyStr))
	return decrypt(keyBytes[:], cryptoText)
}

// decrypt from base64 to decrypted string
func decrypt(key []byte, cryptoText string) string {
	ciphertext, err := base64.StdEncoding.DecodeString(cryptoText)
	Check(err)

	block, err := aes.NewCipher(key)
	Check(err)

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	if len(ciphertext) < aes.BlockSize {
		panic("ciphertext too short")
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]
	stream := cipher.NewCFBDecrypter(block, iv)

	// XORKeyStream can work in-place if the two arguments are the same.
	stream.XORKeyStream(ciphertext, ciphertext)
	return fmt.Sprintf("%s", ciphertext)
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
func Check(e error) {
	if e != nil {
		log.Fatal(e)
		panic(e)
	}
}

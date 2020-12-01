package utils

import (
	"log"
	"os"
	"crypto/sha512"
	"encoding/hex"
)

func Check(e error) {
	if e != nil {
		log.Fatal(e)
		panic(e)
	}
}

func SoftCheck(e error){
	if e != nil {
		log.Println(e)
	}
}

func Kill(code int) {
	os.Exit(code)
}

func SHA512 (plaintext string) string{
	sha_512 := sha512.New()
	sha_512.Write([]byte(plaintext))
	return hex.EncodeToString(sha_512.Sum(nil))
}

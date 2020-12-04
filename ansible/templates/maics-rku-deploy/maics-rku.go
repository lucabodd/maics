package main

import (
    "crypto/tls"
    "crypto/sha256"
    "crypto/ecdsa"
    "crypto/rand"
    "bytes"
    . "./pkg/utils"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
    "os/user"
    "golang.org/x/crypto/ssh"
    b64 "encoding/base64"
    gjson "github.com/tidwall/gjson"
    "strings"
    "strconv"
)


func main() {
    host_id := "{{ host_id }}"
    aes_shared_key := "{{ aes_shared_key }}"
    url := "{{ maics_url }}"
    usr, err := user.Current()
    Check(err)

    byteKey := []byte(`{{ ecdsa_private_key.stdout }}`)
	privk, err := ssh.ParseRawPrivateKey(byteKey)
    Check(err)
	privateKey, _ := privk.(*ecdsa.PrivateKey)


    //setup TLS
    http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{InsecureSkipVerify: true}

    enc_ts := AESencrypt(aes_shared_key, TimeCurrent())

    reqBody, err := json.Marshal(map[string]string{
        "host_id": host_id,
        "user":    usr.Name,
        "ts": enc_ts,
    })
    Check(err)

    resp, err := http.Post(url+"/api/challenge",
        "application/json", bytes.NewBuffer(reqBody))
    Check(err)
    defer resp.Body.Close()
    body, err := ioutil.ReadAll(resp.Body)
    cookies := resp.Cookies()[0]
    Check(err)

    if(resp.StatusCode !=200){
        fmt.Println("[-] ERROR: got "+strconv.Itoa(resp.StatusCode)+" "+string(body)+", Killing.")
        Kill(1)
    }
    fmt.Println("[+] Challenge received, authenticating challenge")

    challenge := gjson.Get(string(body), "challenge").String()
    enc_ts = gjson.Get(string(body), "ts").String()

    dec_challenge := AESdecrypt(aes_shared_key, challenge)
    dec_ts := AESdecrypt(aes_shared_key, enc_ts)

    if(string(dec_ts[len(dec_ts)-1:])!="Z" || TimeSecondsDiff(dec_ts)>=60 ){
        fmt.Println("[-] ERROR: cannot authenticate challenge, check time between the two hosts")
        Kill(1)
    }
    fmt.Println("[+] Challenge authenticated sending response")

	hash := sha256.Sum256([]byte(dec_challenge))
	sig, err := ecdsa.SignASN1(rand.Reader, privateKey, hash[:])
	Check(err)
    ecdsa_response_signature := b64.StdEncoding.EncodeToString(sig)

    //sending response
    request, err := http.NewRequest("POST", url+"/api/verify-response", strings.NewReader(`{"response":"`+ ecdsa_response_signature+`"}`))
    Check(err)
    request.AddCookie(cookies)
    request.Header.Add("Content-Type", "application/json")

    client := &http.Client{}

    resp, err = client.Do(request)
    Check(err)
    defer resp.Body.Close()
    body, err = ioutil.ReadAll(resp.Body)
    Check(err)

    if(resp.StatusCode !=200){
        fmt.Println("[-] ERROR: "+strconv.Itoa(resp.StatusCode)+", "+string(body))
        Kill(1)
    }
    fmt.Println("[+] Host verified via ECDSA signature key unlocked for "+usr.Name+" (uid="+usr.Uid+")")


}

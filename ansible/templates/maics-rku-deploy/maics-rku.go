package main

import (
    "bytes"
    . "./pkg/utils"
    "log"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
    "os/user"
    "crypto/tls"
)

func main() {
    host_id := "{{ host_id }}"
    aes_shared_key := "{{ aes_shared_key }}"
    url := "{{ maics_url }}"
    usr, err := user.Current()

    Check(err)
    log.Println(host_id)
    log.Println(aes_shared_key)
    log.Println(url)
    log.Println(TimeCurrent())

    //setup TLS
    http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{InsecureSkipVerify: true}


    enc_ts := AESencrypt(aes_shared_key, TimeCurrent())
    dec_ts := AESdecrypt(aes_shared_key, enc_ts)
    log.Println(enc_ts)
    log.Println(dec_ts)

    reqBody, err := json.Marshal(map[string]string{
        "host_id": host_id,
        "user":    usr.Name,
        "ts": enc_ts,
    })
    if err != nil {
        print(err)
    }
    resp, err := http.Post(url+"/api/challenge",
        "application/json", bytes.NewBuffer(reqBody))
    Check(err)
    defer resp.Body.Close()
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        print(err)
    }
    fmt.Println(string(body))

}

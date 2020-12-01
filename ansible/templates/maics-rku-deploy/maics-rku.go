package main

import (
    . "./pkg/utils"
    "log"
)

func main() {
    host_id = "{{ host_id }}"
    aes_shared_key = "{{ aes_shared_key }}"
    url = "{{ maics_url }}"
    user, err := user.Current()
	Check(err)
    log.Println(host_id)
    log.Println(aes_shared_key)
    log.Println(maics_url)

    reqBody, err := json.Marshal(map[string]string{
        "username": "Krunal Lathiya",
        "email":    "krunal@appdividend.com",
    })
    if err != nil {
        print(err)
    }
    resp, err := http.Post("https://httpbin.org/post",
        "application/json", bytes.NewBuffer(reqBody))
    if err != nil {
        print(err)
    }
    defer resp.Body.Close()
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        print(err)
    }
    fmt.Println(string(body))
    ey := AESencrypt(key, user.SshPublicKey)

}

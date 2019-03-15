// estuary.xebec-urman-fs001-us-east.cdn.qloppi.com

// this lets an estuarying user use the 'save as' feature in the estuary extension running in the remote chromium browser
// by supplying a proxy for the image requested to be downloaded.. this is simliar functionality to the cors-anywhere package
// but adds additional security by adding an expiration date and confirming the request is being made from an estuarying user and not a passerby

require('dotenv').config()

const saveasport = 5054

const maxuploadsize = 10485760 // 10 MiB

const http = require('http')
const request = require("request")
const CryptoJS = require("crypto-js")
const base32 = require("base32")
const fs = require("fs")
const filename = "friend.jpg"

const realurldecipher = (requrl) => {
  
  //  extract the real URL from the requrl (not prefixed with /, either)
  
  let realurl
  
  try {
    
    if (!requrl) {
      console.log("none")
      return false
    }
    let path = requrl.split("/")
    let bytes  = CryptoJS.AES.decrypt(base32.decode(path[1]), process.env.aes)
    let plaintext = bytes.toString(CryptoJS.enc.Utf8)
    let json = JSON.parse(plaintext)

    if (json.e !== true) {
      return false
    }
    
    let now = (+ new Date())
    
    if (!json.c) {
      console.log("no timestamp")
      return false
    }
    
    console.log(`time elapsed: ${now - json.c}`)
    
    if (now - json.c > 3600000) {
      // an hour has passed.. token is now invalid
      return false
    }
    
    path.splice(1,1)
    realurl = path.join("/").substring(1)
    
    if (realurl.length === 0 || realurl.length > 1000) {
      return false
    }
    
    return realurl
    
  }
  catch(e) {
    return false
  }
  
}

// let tryurl = "http://localhost:5054/amt4cwv48xb6pp1h5x63cdv3etcq8e34agu5ayj1ahk78ebdcdbpuau4et95jrtfet13jkj269bnark35x8mej2q6t3mectkd1mqjutk98qp6k2qb1a64nb28grkamv1egw4ymk260u78tjuagr7ghuqdd87jt3p8h42pdveex8ku/https://i.imgur.com/hRF1n01.png"
// 
// let trypath = "/amt4cwv48xb6pp1h5x63cdv3etcq8e34agu5ayj1ahk78ebdcdbpuau4et95jrtfet13jkj269bnark35x8mej2q6t3mectkd1mqjutk98qp6k2qb1a64nb28grkamv1egw4ymk260u78tjuagr7ghuqdd87jt3p8h42pdveex8ku/https://i.imgur.com/hRF1n01.png"

// let results = realurldecipher(trypath)
// console.log(results)

http.createServer(function(req, res) {
  try {
    let url = realurldecipher(req.url)
    if (!url) {
      res.statusCode = 400
      res.end()
      return
    }
    request({
      url: url,
      method: "HEAD"
    }, 
    function(err, headRes) {
      var size = headRes.headers['content-length']
      if (size > maxuploadsize) {
        res.statusCode = 413
        res.end()
      }
      else {
        var size = 0
        var subrequest = request({url})
        subrequest.on('data', function(data) {
          size += data.length
          if (size > maxuploadsize) {
            res.statusCode = 413
            subrequest.abort()
          }
        }).pipe(res)
      }
    })  
  }
  catch(e) {
    console.error(e)
    
    res.end()
  }
  
}).listen(saveasport)

console.log("saveas, 5054")

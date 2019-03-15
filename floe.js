// running on estuary.congiary-zurna-fs001-us-east.cdn.qloppi.com

require('dotenv').config()
const floeport = 5050
const http = require('http')
const httpProxy = require('http-proxy')
const proxy = httpProxy.createProxyServer({})
const CryptoJS = require("crypto-js")
const base32 = require("base32")

// need aes, decrypt incoming token

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  proxyReq.setHeader('X-Special-Proxy-Header', 'estuary')
})

const urldecipher = (requrl) => {
  
  // extract the requested URL from the requrl (prefixed with /)
  // also, determine which port to use
  
  let cleanurl
  let port
  
  try {
    
    if (!requrl) {
      throw new Error("no url provided")
    }
    let path = requrl.split("/")
    
    // get the cryptoken from the url
    // if too much time has elapsed (>1 minute) from the time this token was created,
    // this is an old token and should be rejected
    
    let bytes  = CryptoJS.AES.decrypt(base32.decode(path[1]), process.env.aes)
    let plaintext = bytes.toString(CryptoJS.enc.Utf8)
    let json = JSON.parse(plaintext)
    
    if (json.e === true) {
      port = 8081
    }
    else if (json.e === false) {
      port = 8080
    }
    else {
      throw new Error("no port was declared in estuary5052")
    }    
    
    path.splice(1,1)
    cleanurl = path.join("/")
    
    if (cleanurl.length === 0 || cleanurl.length > 1000) {
      throw new Error("bad url provided")
    }
    
    return {
      cleanurl, port
    }
    
  }
  catch(e) {
    throw e
  }
  
}

const floeserver = http.createServer(function(req, res) {
  
  let cleanurl
  let port
  let deciphered
  
  try {
    deciphered = urldecipher(req.url)
    port = deciphered.port
    cleanurl = deciphered.cleanurl
  }
  catch(e) {
    res.end()
    return
  }
  
  // substitute the raw req.url with the version that has removed the cryptoken
  
  req.url = cleanurl
  
  try {
    proxy.web(req, res, {
      target: `http://127.0.0.1:${port}`
    })
    proxy.on('error', function (err, req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('error connecting to estuary.. an admin has been notified.. please try again tomorrow..')
    })
  }
  catch(e) {
    res.end()
    return
  }
})

//const WsTransformStream = require('ws-transform-stream')
const uuid = require('uuid')

floeserver.on('upgrade', function (req, socket, head) {
  
  req.id = uuid.v4()
  
  // function transform(message) {
  //   console.log(req.id)
  //   console.log(message.toString('utf8'))
  //   return message
  // }

  // function createWsClientTransformStream(req) {
  //   return WsTransformStream.fromUpgradeRequest(req, { transform });
  // };   
  
  let port
  try {
    let deciphered = urldecipher(req.url)
    port = deciphered.port
  }
  catch(e) {
    return
  }
  try {
    proxy.ws(req, socket, head, { 
      target: `ws://127.0.0.1:${port}/websockify`
      // createWsClientTransformStream
    })
  }
  catch(e) {
    console.error("failure upgrading")
    console.error(e)
  }
})

console.log("floe, 5050")
floeserver.listen(floeport)

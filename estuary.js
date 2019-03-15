// running on estuary.quotha-yarnwindle-fs001-us-east.cdn.qloppi.com

require('dotenv').config()

const estuaryport = 5052

const minibogserverip = "127.0.0.1"

const axios = require('axios')
const CryptoJS = require("crypto-js")
const base32 = require("base32")
const util = require('util')
const exec = util.promisify(require('child_process').exec)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const estuary = {}

// updatable globals

let usercount = 0
let leaderdisconnectedwaitingforreconnection = false
let leadername = 0
let serverstartingup = false
let servershuttingdown = false

const maxusercount = 6

// in the event the leader has left while other users are online, 
// convert this to a timer and cleartimeout if they log back on

let stopservertimer = null

estuary.handler = {
  
  killallconnectionsandstoptheestuaryserver: async function() {
    for (client in estuary.server.clients) {
      estuary.server.clients[client].close()
    }
    return true
  },
  
  signifyuserisestuarying: async function(wsc, isleader) {
    for (let i = 0; i < estuary.server.clients.length; i++) {
      let client = estuary.server.clients[i]
      if (wsc.socket._peername.port === client.socket._peername.port) {
        estuary.server.clients[i].estuary = true
        estuary.server.clients[i].estuaryisleader = isleader
      }
    }
    return true
  },
  
  serverstartup: async function() {
    if (servershuttingdown) {
      await sleep(20000)
    }
    
    // doublecheck and ensure the previous container has been destroyed
    const { stdout, stderr } = await exec(`docker stop estuary; docker system prune -f; docker run -d --name estuary -it -p 127.0.0.1:8080:8080 -p 127.0.0.1:8081:8081 -v /dev/shm:/dev/shm vnc`)
 
    serverstartingup = true
    
    await sleep(15000)
    serverstartingup = false
    
    // // through bogchat, broadcast to everyone that someone is estuarying
    // // avoiding DNS, use IP

    try {
      axios.post(`http://${minibogserverip}:9377`, {
        token: process.env.estuarytoken,
        type: "online",
        leadername
      })   
    }
    catch(e) {
      console.error(e)
    }    

    return true
  },
  
  servershutdown: async function() {
    if (servershuttingdown) {
      return
    }
    servershuttingdown = true
    
    if (serverstartingup) {
      await sleep(15000)
    }
    
    const { stdout, stderr } = await exec(`docker stop estuary; docker system prune -f`)
    
    await sleep(10000)
    
    // kill all connections and clear clients list
    
    servershuttingdown = false   
    leadername = 0
    usercount = 0
    leaderdisconnectedwaitingforreconnection = false
    clients = []

    // // through bogchat, broadcast to everyone that no one is estuarying
    // // avoiding DNS, use IP

    try {
      axios.post(`http://${minibogserverip}:9377`, {
        token: process.env.estuarytoken,
        type:"offline"
      })   
    }
    catch(e) {
      console.error(e)
    }    
    return
  }
  
}


estuary.api = {}

estuary.api["init"] = async function(wsc, data) {
  
  // handle the logic of initiating a connection based on data the user provided  
  
  try {
    if (usercount > maxusercount) {
      estuary.server.send(wsc, {
        type: "full"
      })    
      return
    }
    if (!data || !data.username) {
      return
    }
    let username = data.username
    if (!username) {
      return
    }
    var pregex = new RegExp("[^a-zA-Z0-9]")
    if (pregex.test(username)  ) {
      return
    }
    else if ( username.length > 16 ) {
      return
    }
    
    let password = data.password
    
    if (servershuttingdown || serverstartingup) {
      estuary.server.send(wsc, {
        type: "busypleasecomebacklater"
      })    
      return
    }
    
    let token
    let leaderself = false
    
    //  are there no users in the system, 
    //  and this user is providing a password that is correct?
    //  therefore the server is considered offline..
    //  therefore set this user up as the estuarying leader
    
    if ( usercount === 0 
      && password === process.env.estuarypass ) {
      clearTimeout(stopservertimer)
      stopservertimer = null
      leadername = username
      leaderself = true
      usercount++
      
      // let them know that the server is getting ready
      
      await estuary.handler.signifyuserisestuarying(wsc, true)
      estuary.server.send(wsc, {
        type: "wait"
      })
      await estuary.handler.serverstartup()
      await sleep(10000)
      token = {
        e: true
      }    
    }
    
    // are there some users already in the system,
    // but no password was provided?
    // therefore this is just a viewer of the estuarying session..
    // therefore set this user up as a viewer
    
    else if ( usercount !== 0 
      && !password ) {
      usercount++
      await estuary.handler.signifyuserisestuarying(wsc, false)
      token = {
        e: false
      }  
    }
    
    //  some users are already in the system..
    //  and this user was sending in a password that was correct..
    //  and their username is the same is the current leader of this estuarying session..
    //  but there is no indication that the old leader session has ended?
    //  therefore this is the leader that is opening up a new tab trying to create 2 leader sessions..
    //  therefore reject leader request and set this session up as viewer
    
    else if ( usercount !== 0 
      && password === process.env.estuarypass 
      && leadername === username 
      && !leaderdisconnectedwaitingforreconnection ) {
      usercount++
      await estuary.handler.signifyuserisestuarying(wsc, false)
      token = {
        e: false
      }       
    }
    
    //  some users are already in the system..
    //  and this user was sending in a password that was correct..
    //  and their username is the same is the current leader of this estuarying session..
    //  and there is an indication that the old leader session has ended?
    //  therefore this is the leader got disconnected and is trying to reconnect as the leader..
    //  therefore accept leader request and set this session up as leader without spawning a new server  
    
    else if ( usercount !== 0 
      && password === process.env.estuarypass 
      && leadername === username
      && leaderdisconnectedwaitingforreconnection ) {
      leaderdisconnectedwaitingforreconnection = false
      clearTimeout(stopservertimer)
      leaderself = true
      usercount++
      await estuary.handler.signifyuserisestuarying(wsc, true)
      token = {
        e: true
      }        
    }    
    
    //  some users are already in the system..
    //  and this user is sending in a password that was correct..
    //  but this user is another legit estuaryer that is trying to be the leader in the middle of an estuarying session they arent the leader of?
    //  therefore reject their request to initiate a leader position and set them up as a viewer
    
    else if ( usercount !== 0 
      && password === process.env.estuarypass 
      && leadername !== username ) {
      usercount++
      await estuary.handler.signifyuserisestuarying(wsc, false)
      token = {
        e: false
      }        
    }
    
    //  some users are already in the system..
    //  and this user is a legit estuaryer with a co-leader password making a co-leader request
    //  therefore dont designate them as the real leader but give them a valid leader token creating two leader connections
    
    else if ( usercount !== 0 
      && password === process.env.estuarycopass ) {
      usercount++
      await estuary.handler.signifyuserisestuarying(wsc, false)
      token = {
        e: true
      }        
    }

    //  handle all other logic, this is the result of bad passwords or other mischief
    
    else {
      estuary.server.send(wsc, {
        type: "badpass"
      })    
      return    
    }
    
    // update token
    
    token.i = wsc.remoteAddress
    token.u = username
    token.c = (+ new Date())
    
    // floe functionality using this token is valid for 1 minute
    // saveas functionality using this token is valid for 60 minutes
    
    let cryptoken = base32.encode(CryptoJS.AES.encrypt(JSON.stringify(token), process.env.aes).toString())

    // send the user an init response
    
    estuary.server.send(wsc, {
      type: "init", 
      data:{
        token: cryptoken,
        leadername,    // the name of the leader
        leaderself // is this client making the request the leader?
      }
    })
  }
  catch(e) {
    console.error(e)
  }
}

// TODO send an upgrade signal which will include a new token indicating they are the leader
// TODO send a downgrade token which will include a new token indicating they are the viewer

estuary.api["mousemove"] = async function(wsc, data) {
  estuary.server.broadcastexceptme(wsc, {
    type: "mousemove", 
    data: {
      coords: data,
      client: wsc.socket._peername.port,
      leader: wsc.estuaryisleader
    }
  })  
}

estuary.server = {
  
  clients: [],

  broadcastexceptme: (wsc, json) => {
    if (estuary.server.clients.length === 1) {
      return
    }
    for ( let i=0; i < estuary.server.clients.length; i++ ) {
      if (estuary.server.clients[i].socket._peername.port === wsc.socket._peername.port) {
        continue
      }
      else {
        estuary.server.clients[i].sendUTF(JSON.stringify(json))
      }
    }      
  },
  
  broadcast: (json) => {
    for ( let i=0; i < estuary.server.clients.length; i++ ) {
      estuary.server.clients[i].sendUTF(JSON.stringify(json))
    }      
  },
  
  send: (wsc, json) => {
    wsc.sendUTF(JSON.stringify(json))      
  },
  
  listen: () => {
    
    let clients = estuary.server.clients

    const http = require('http')
    const httpServer = http.createServer()
    const websocketserver = require('websocket').server
    const wss = new websocketserver({ httpServer })  
    
    httpServer.listen(estuaryport)
    
    wss.on('request', function(request) {
    
      const wsc = request.accept(null, request.origin)
      clients.push(wsc)
      
      wsc.on('message', function(msg) {
        try {
          let json = JSON.parse(msg.utf8Data)
          estuary.api[json.type] ? estuary.api[json.type](wsc, json.data) : () => {}
        }
        catch(e) {
          console.error(e)
        }
      })
      
      wsc.on('close', async function(e) {
        let estuaryuserfound = false
        
        for (let i = 0; i < clients.length; i ++) {
          let client = clients[i]
          
          if (wsc.socket._peername.port === client.socket._peername.port) {
              
            if (client.estuary) {
              estuaryuserfound = true
              usercount--
              estuary.server.broadcast(wsc, {
                type: "mousedestroy", 
                data: wsc.socket._peername.port
              })                
            }
            if (client.estuaryisleader && usercount !== 0) {
              // the leader was disconnected, but there are still viewers.
              // set up a self-destructing countdown to shut the server off if the leader doenst come back.
              stopservertimer = setTimeout(()=>{
                estuary.handler.killallconnectionsandstoptheestuaryserver()
              },20000)
              leaderdisconnectedwaitingforreconnection = true
            }
            clients.splice(i, 1)
          }
        }
        if (estuaryuserfound === true && clients.length === 0) {
          leaderdisconnectedwaitingforreconnection = false
          clearTimeout(stopservertimer)
          await estuary.handler.servershutdown()
        }
        
      })
    }) 
    // close any stuck docker containers
    estuary.handler.servershutdown()
  }
}

console.log("estuary, 5052")
estuary.server.listen()

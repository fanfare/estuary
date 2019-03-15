// portable mini-bog server

require('dotenv').config()

const http = require("http")
const chapel = false

// the port where this mini bogchat instance should run for testing
const minibogport = '7893'

// the port where bog's estuary module should be listening
const estuaryport = '9377'

// the ip of the machine where estuary/floe (the X session) resides
const validestuaryfloeserverip = "::ffff:157.230.4.96"

// // portable mini-bog server for testing estuary
// // minibog server: ws://bog.jollo.org:7893
// // bog's estuary POST listener: http://bog.jollo.org:9377
// // client side expected to support a means to pass signal to bog.estuary (client)

// // IMPORTANT: in production (on the actual bogchat server), 
// // ensure estuary sends a broadcast via broadcast()

const estuary = {
  active: false,
  count: 0
}

const bog = {}

bog.api = {}

bog.api["estuarystatusrequest"] = async function(wsc, data) {
  let status = (estuary.active) ? "online" : "offline"
  bog.server.send(wsc, {type:'estuary', data: {
    type: "serverstatus",
    data: {
      status
    }
  }})
}

bog.server = {
  
  clients: [],

  broadcastexceptme: (wsc, json) => {
    for ( let i=0; i < bog.server.clients.length; i++ ) {
      if (clients[i].socket._peername.port === wsc.socket._peername.port) {
        continue
      }
      else {
        bog.server.clients[i].sendUTF(JSON.stringify(json))
      }
    }      
  },
  
  broadcast: (json) => {
    for ( let i=0; i < bog.server.clients.length; i++ ) {
      bog.server.clients[i].sendUTF(JSON.stringify(json))
    }      
  },
  
  send: (wsc, json) => {
    wsc.sendUTF(JSON.stringify(json))      
  },
  
  listen: () => {
    
    let clients = bog.server.clients
    const httpServer = http.createServer()
    const websocketserver = require('websocket').server
    const wss = new websocketserver({ httpServer })  
    httpServer.listen(minibogport)
    wss.on('request', function(request) {
      const wsc = request.accept(null, request.origin)
      clients.push(wsc)
      bog.server.broadcast({type:'heartbeat', data: {}})
      wsc.on('message', function(msg) {
        try {
          let json = JSON.parse(msg.utf8Data)
          bog.api[json.type] ? bog.api[json.type](wsc, json.data) : () => {}
        }
        catch(e) {
          console.error(e)
        }
      })      
      wsc.on('close', function(e) {
        for (let i = 0; i < clients.length; i ++) {
          if (( wsc.remoteAddress == clients[i].remoteAddress ) 
            && (wsc.socket._peername.port == clients[i].socket._peername.port)) {
            clients.splice(i, 1)
          }
        }
      })
    }) 
  }
}

bog.server.listen()

// // end of portable mini-bog server



const estuarylistener = new http.Server()

estuarylistener.on('request', (req, res) => {
  
  let method = req.method.toLowerCase()
  if (method === "post" || method === "options") {
    let body = []
    req.on('data', (chunk) => {
      body.push(chunk)
    })
    .on('end', async function() {
      try {
        if (chapel.open) {
          res.writeHead(400, {
            "Access-Control-Allow-Origin": "*"
          })
          res.end()
          return        
        }
      
        body = Buffer.concat(body).toString()
        let data = JSON.parse(body)
        let ip = req.connection.remoteAddress
        
        if ( (ip === validestuaryfloeserverip && data.type === "copyurl")
          || (ip === validestuaryfloeserverip && data.type === "saveas") 
          || (ip === validestuaryfloeserverip && data.type === "postimage")) {
          // permissible
          // broadcast to the estuary.leader if they are available
          // the real estuary leader will process this signal, the rest will snub
          bog.server.broadcast({type:'estuary', data: {
            type: "imageevent",
            data: {
              type: data.type,
              data: data.data
            }
          }})          
          return
        }
        else if (data.token != process.env.estuarytoken) {
          console.error("token doesnt match")
          res.writeHead(401, { 
            "Access-Control-Allow-Origin": "*"
          })
          res.end()           
          return        
        }
        if (!data.type) {
          console.error("no datatype provided")
          res.writeHead(401, { 
            "Access-Control-Allow-Origin": "*"
          })
          res.end()           
          return            
        }

        if (data.type === "online") {
          estuary.active = true
          bog.server.broadcast({type:'estuary', data: {
            type: "serverstatus",
            data: {
              status: "online"
            }
          }})
          res.end()
          return           
        }
        else if (data.type === "offline") {
          estuary.active = false
          bog.server.broadcast({type:'estuary', data: {
            type: "serverstatus",
            data: {
              status: "offline"
            }
          }})
          res.end()
          return            
        }
        else {
          res.writeHead(401, { 
            "Access-Control-Allow-Origin": "*"
          })
          res.end()           
          return           
        }
      }
      catch(e) {
        console.log(console.error(e))
        res.writeHead(500, { 
          "Access-Control-Allow-Origin": "*"
        })
        res.end()           
        return        
      }
    })
  }
  else {
    res.end('\n')
  }
});

estuarylistener.listen(estuaryport, () => {
  console.log(`listening on port ${estuaryport}`)
})

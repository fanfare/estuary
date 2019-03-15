//let cursor = document.getElementById("cursor")

const server = {
  
  // the floe proxy server (internal 5050)
  floe: "https://estuary.congiary-zurna-fs001-us-east.cdn.qloppi.com",
  
  // the estuary websocket server (internal 5052)
  websocket: "wss://estuary.quotha-yarnwindle-fs001-us-east.cdn.qloppi.com"
  
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const app = {

  data: {
    waiting: false,
    leaderself: false,
    lastproxy: null
  },

  handler: {
  
    setup: {
      
      init: (data) => {
        app.io.sockets({
          type: "init",
          data: {
            password: data.password,
            username: data.username
          }
        })        
      },
      
      error: () => {
        document.getElementById("iframe").innerHTML = `error visiting estuary.. perhaps it is closed..`
      },
      
      wait: () => {
        if (app.data.waiting) {
          document.getElementById("iframe").innerHTML = `<img src="loading.gif"><br>en route to estuary.. please wait a moment.. ${(+ new Date())}
  <br><br>
  by continuing, you agree you will not use estuary to access pornography, copyrighted material, anything explicit, grotesque, obscene or illegal. you also agree not to engage in bandwidth-heavy content (youtube, streaming videos, etc), and you agree not to install anything or download large files or do anything nefarious. please be gentle with this thing.. thanks very much.`

          setTimeout(()=>{
            requestAnimationFrame(app.handler.setup.wait)
          },50)

        }
      },
      
      busypleasecomebacklater: () => {
        document.getElementById("iframe").innerHTML = `the server is in the middle of an operation.. this will keep trying to reconnect.. please wait..<br><br>time: ${(+ new Date())}`
        setTimeout(()=>{
          window.location.reload()
        },2500)
      },
      
      badpass: () => {
        document.getElementById("iframe").innerHTML = `error connecting.. bad password maybe..`
      },
      
      full: () => {
        document.getElementById("iframe").innerHTML = `estuary is full right now.. please try again later..`
      },
    
      loading: (() => {
        document.getElementById("iframe").innerHTML = `estuary is loading..`
      })(),
      
      loaded: (data) => {
        
        try {
          
          if (data.leaderself) {
            app.data.leaderself = true
            window.parent.postMessage(JSON.stringify({
              type: "leaderself"
            }), "*")            
          }
          
          app.data.waiting = false
          
          
          // pass along the cipher and wrap in a boundary
          // let the estuary.js parent frame know about the token so it can make saveas requests
          
          window.parent.postMessage(JSON.stringify({
            type:"tokenupdate", 
            data: data.token
          }), "*")

          let url = `${server.floe}/${data.token}/`
          
          app.data.lastproxy = url
          
          // possibly url and estuarying bool
          // do something to build the iframe and handle whether or not you are estuarying
          
          document.getElementById("iframe").innerHTML = `
            <iframe id="proxy" width=1028 height=640 style="width:1028px; height:640px; border:none" src="${url}"></iframe>
          `
        }
        catch(e) {
          console.error(e)
        }
      }
    
    },
  
    cursor: (x,y) => {
      app.io.sockets({
        type: "mousemove",
        data: {x,y}
      })
    },
    
    // once its set up start a beacon and keep track of the frame
    // if a connection is lost depending on your authorization then restore or do whatever with iframe
    
    beacon: {
      disconnected: () => {
        app.ui.frame.rebuild()
      }
    }
  },
  
  ui: {
  
    cursor: {
      
    
      destroy: (id) => {

      },
    
      move: (id, x, y) => {
        //
        //console.log(x,y)
        try {
          document.getElementById(`cursor${id}`).style.left = `${x}px`
          document.getElementById(`cursor${id}`).style.top = `${y}px`
        }
        catch(e) {
          console.error(id, x, y)
        }
      }
    
    },
    
    frame: {
    
      rebuild: async function() {
        // replace #proxy src with "#" .. then wait a moment
        for (let i=0;i<80;i++) {
          document.getElementById("iframe").innerHTML = `
            lost connection.. reconnecting.. ${(+ new Date())}
          `
          await sleep(50)
        }
        document.getElementById("iframe").innerHTML = `
          <iframe id="proxy" width=1028 height=640 style="width:1028px; height:640px; border:none" src="${app.data.lastproxy}"></iframe>
        `
      }
    
    }
    
  },

  io: {
  
    sockets: (()=>{
      
      // const ws = new WebSocket("ws://localhost:5052")
      const ws = new WebSocket(server.websocket)
      
      const send = (json) => {
        ws.send(JSON.stringify(json))
      }
      
      ws.onopen = () => {
        window.parent.postMessage(JSON.stringify({type:"passrequest"}), "*")
      }
      
      ws.onmessage = (e) => { 
        let json = JSON.parse(e.data);
        (({
          mousemove: () => {
            // does the cursor client exist?
            // if not make it with the leader style
            // otherwise move
            if (document.getElementById(`cursor${json.data.client}`).length === 0) {
              app.ui.cursor.create(
                json.data.client,
                json.data.leader,
                json.data.coords.x,
                json.data.coords.y
              )
              console.log(`creating cursor for ${json.data.client}`)
            }
            else {
              app.ui.cursor.move(
                json.data.client,
                json.data.coords.x,
                json.data.coords.y
              )
            }
          },
          mousedestroy: () => {
            // app.ui.cursor.destroy(json.data)
          },
          busypleasecomebacklater: () => {
            console.log(json.data)
            app.handler.setup.busypleasecomebacklater()
          },          
          wait: () => {
            app.data.waiting = true
            app.handler.setup.wait()
          },          
          full: () => {
            app.handler.setup.full()
          },          
          badpass: () => {
            app.handler.setup.badpass()
          },          
          init: () => {
            app.data.waiting = false
            console.log(json.data)
            app.handler.setup.loaded(json.data)
          }
        })[json.type] || (() => {  } ))()
      }
      
      ws.onclose = () => { 
        // kill this window
        console.log("received signal from server that this session has closed")
        // send signal to the parent to destroy this estuarying session
        window.parent.postMessage(JSON.stringify({type:"leaderhassignedoff"}), "*")
      }
      
      ws.onerror = () => {
        app.handler.setup.error()
      }
      
      return send
    
    })(),
    
    frames:(()=>{
    
      const frames = {
      
        send: () => {
          document.getElementsByTagName("iframe")[0].contentWindow.postMessage("ping", "*")
        },
        
        receive: (() => {
          window.addEventListener('message', function(e) {
            let json = JSON.parse(e.data);
            (({
              // these are coming from the children
              mousemove: () => {
                // does the cursor exist yet?
                //   no? create it -- with leader styles
                // it does? move this specific cursor
                app.handler.cursor(
                  json.data.x,
                  json.data.y
                )
              },

              disconnected: () => {
                app.handler.beacon.disconnected()
              },
              pong: () => {
                // app.handler.beacon.receive()
              },
              init: () => {
                // app.handler.beacon.init()
              },
              // this is coming from the parent
              passrequest: () => {
                app.handler.setup.init(json.data)
              }
            })[json.type] || (() => {  } ))()
          },false) 
        })()
        
      }
      
      return frames
      
    })()
  
  }

}

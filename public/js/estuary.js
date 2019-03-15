const server = {
  
  // the saveas image proxy server (internal 5054)
  saveas: "https://estuary.xebec-urman-fs001-us-east.cdn.qloppi.com"
  
}

// bogchat overview:

// set estuary password via:
// /estuary password

// actions.js:

// estuary: () => {
//   if (b) {
//     localStorage.setItem("estuarytoken", b)
//   }
// }

// connect.js:

// estuary: () => {
//   bog.estuary(json.data)
// }

// extend jquery to allow draggability to the estuary container

;(function($) {
  $.fn.drags = function(opt) {
    opt = $.extend({handle:"#estuaryhandle",cursor:"move"}, opt)
    if (opt.handle === "") {
      var $el = this
    } 
    else {
      var $el = this.find(opt.handle)
    }
    return $el.css('cursor', opt.cursor).on("mousedown", function(e) {
      if (opt.handle === "") {
        var $drag = $(this).addClass('draggable')
      }  
      else {
        var $drag = $(this).addClass('active-handle').parent().addClass('draggable')
      }
      var z_idx = $drag.css('z-index')
      var drg_h = $drag.outerHeight()
      var drg_w = $drag.outerWidth()
      var pos_y = $drag.offset().top + drg_h - e.pageY
      var pos_x = $drag.offset().left + drg_w - e.pageX
      $drag.css('z-index', 1000).parents().on("mousemove", function(e) {
        $('.draggable').offset({
          top:e.pageY + pos_y - drg_h,
          left:e.pageX + pos_x - drg_w
        }).on("mouseup", function() {
          $(this).removeClass('draggable').css('z-index', z_idx)
        })
      })
      e.preventDefault() // disable selection
    })
    .on("mouseup", function() {
      if (opt.handle === "") {
        $(this).removeClass('draggable');
      } 
      else {
        $(this).removeClass('active-handle').parent().removeClass('draggable')
      }
    })
  }
})(jQuery)

bog.estuary = (()=>{
  
  const estuary = {
    
    handler: {
      
      saveas: (url) => {
        function getfilename(path) {
          try {
            const filename = decodeURIComponent(new URL(path).pathname.split('/').pop())
            if (!filename) {
              throw new Error("no filename")
            }
            return filename
          }
          catch(e) {
            return `${(+ new Date()).toString()}.png`
          }
        }         
        function estuaryfilesaveas(path) {
          var xhr = new XMLHttpRequest()
          // to circumvent CORS
          // use an authentication-based image proxy to deliver this image
          xhr.open('GET', `${server.saveas}/${estuary.data.token}/${path}`, true)
          xhr.responseType = "blob"
          xhr.onreadystatechange = function () { 
            if (xhr.readyState == 4) {
              if (xhr.status !== 200) {
                estuary.handler.copyurl(url)
              }
              let blob = xhr.response
              let href = URL.createObjectURL(blob)
              estuarydownload.download = getfilename(path)
              estuarydownload.href = href
              estuarydownload.click()
            }
          }
          xhr.send(null)
        }
        estuaryfilesaveas(url)        
      },
      
      copyurl: (url) => {
        // append to input
        if ($('#input').val().length > 0) {
          $('#input').val($('#input').val() + " " + url + " ")
        }
        else {
          $('#input').val(url + " ")
        }
      },
      
      postimage: (url) => {
        if (checkimgurl(url)) {
          send({
            type: "message",
            data: url
          })
        }
        else {
          estuary.handler.copyurl(url)
        }
      }
    },
    
    data: {
      open: false,
      someoneisestuarying: false,
      leaderself: false,
      token: "0"
    },
  
    pass: () => {
      if (localStorage.getItem("estuarytoken")) {
        return localStorage.getItem("estuarytoken")
      }
      else {
        return false
      }
      
    },
    
    // handle button
    events: (()=>{
      
      let estuaryhandlemousedown = false
      $(document).on("mousedown", '#estuaryhandle', ()=>{
        estuaryhandlemousedown = true
        $('#estuary').addClass("mousedowndraggable")
      })
      $(document).on("mouseup", ()=>{
        if (estuaryhandlemousedown) {
          $('#estuary').removeClass("mousedowndraggable")
          estuaryhandlemousedown = false
        }
      })
      $(document).on("click", "#estuaryresize", ()=>{
        $("#estuarycontainer").toggleClass("estuaryresized")
      })
      let estuarybutton = document.getElementById("estuarybutton")
      estuarybutton.addEventListener("click", (e) => {
        estuarybutton.classList.add("nocredsflash")
        setTimeout(()=>{
          estuarybutton.classList.remove("nocredsflash")
        },200)        
        let postpause = true
        if (!estuary.data.open) {
          if ( estuary.data.someoneisestuarying 
            || estuary.pass() ) {
            estuary.ui.open()
          }
          else {
            postpause = false
          }
        }
        else {
          estuary.ui.close()
        }
        if (postpause) {
          estuarybutton.classList.add("disabled")
          setTimeout(()=>{
            estuarybutton.classList.remove("disabled")
            // disable button for 4 seconds
          },4000)
        }
        
      })
      
    })(),
    
    ui: {
      open: () => {
        document.body.classList.add("estuarywindowopen")
        estuary.data.open = true
        document.getElementById("main").insertAdjacentHTML(
          "afterbegin", `
            <div id="estuarycontainer">
              <div id="estuaryhandle"></div>
              <div id="estuaryingpanel">estuaryingpanel</div>
              <div id="estuaryresize"></div>
              <iframe style="background:white" id="estuary" src="estuary/gatefold.html"></iframe>
            </div>
          `)
        setTimeout(()=>{
          $('#estuarycontainer').drags()
        },0)
      },
      close: () => {
        estuary.data.open = false
        document.body.classList.remove("estuarywindowopen")
        try {
          let elem = document.querySelector('#estuary')
          elem.parentNode.removeChild(elem)
          elem = document.querySelector('#estuarycontainer')
          elem.parentNode.removeChild(elem)
        }
        catch(e) {
          
        }
      }
    },
    
    io: (()=>{
      const servernotification = (json) => {
        
        // just use this as the handler
        
        // interpret this json request from bogchat
        // possible types: serverstatus, imageevent
        // json.type, json.data
        // 
        // let type = json.type
        // let data = json.data
        
        try {
          
          let type = json.type
          let data = json.data          
          
          if (type === "serverstatus") {
            
            let status = data.status

            if (status === "online") {
              //  active estuary button
              estuary.data.someoneisestuarying = true
              document.body.classList.add("someoneisestuarying")
            }
            else if (status === "offline") {
              // close estuary windows if open
              // disable active estuary button
              estuary.data.someoneisestuarying = false
              estuary.data.leaderself = false
              document.body.classList.remove("someoneisestuarying")
              estuary.ui.close()
            }
          
          }
          else if (type === "imageevent") {
            
            // everyone on bog will receive this
            // so only trigger it if this is a bog user that is the leader
            
            if (estuary.data.leaderself) {
              let option = data.type
              let url = data.data
              // is this a valid option? execute it if so
              try {
                estuary.handler[option] ? estuary.handler[option](url) : () => {}
              }
              catch(e) {
                console.error(e)
              }
            }
          }
        }
        catch(e) {
          console.error(e)
        }
      }
      
      window.addEventListener('message', function(e) {
        try {
          let json = JSON.parse(e.data)
          if (json.type === "passrequest") {
            document.getElementById("estuary").contentWindow.postMessage(JSON.stringify({
              type: "passrequest",
              data: {
                password: estuary.pass(),
                username: myname
              }
            }),"*")
          }
          else if (json.type === "tokenupdate") {
            estuary.data.token = json.data
          }
          else if (json.type === "leaderself") {
            estuary.data.leaderself = true
          }
          else if (json.type === "leaderhassignedoff") {
            estuary.ui.close()
            estuarybutton.classList.add("disabled")
            setTimeout(()=>{
              estuarybutton.classList.remove("disabled")
            },4000)            
          }
        }
        catch(e) {

        }
      },false)     
      
      // window listener from child for signal its asking for any known password
      // reply with the variable on hand that has the password if it has it
      // otherwise reply null and then that will signify theres no password on hand
      
      return servernotification
      
    })()
  
  }
  
  return estuary.io
  
})();
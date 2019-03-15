// the ip of the bogchat miniserver
const bogchatminiserverip = "127.0.0.1"

const request = function(type, data) {
  const xhr = new XMLHttpRequest()
  xhr.open(
    "POST", 
    // bogchat IP, estuary server port
    `http://${bogchatminiserverip}:9377`
  )
  xhr.setRequestHeader(
    "Content-Type", 
    "text/plain",
  )
  xhr.send(JSON.stringify({
    type, 
    data
  }))  
}

const estuary = {
  saveas: function(e) {
    try {
      if (e && e.srcUrl) {
        request(
          "saveas", 
          e.srcUrl
        )
      }
    }
    catch(e) {
      console.error(e)
    }
       
  },
  copyurl: function(e) {
    try {
      if (e && e.srcUrl) {
        request(
          "copyurl", 
          e.srcUrl
        )
      }
    }
    catch(e) {
      console.error(e)
    }
  },
  postimage: function(e) {
    try {
      if (e && e.srcUrl) {
        request(
          "postimage", 
          e.srcUrl
        )
      }
    }
    catch(e) {
      console.error(e)
    }
  }
}

chrome.contextMenus.create({
  title: "Save image as...", 
  contexts: ["image"], 
  onclick: estuary.saveas
})

chrome.contextMenus.create({
  title: "Copy URL to bog input...", 
  contexts: ["image"], 
  onclick: estuary.copyurl
})

chrome.contextMenus.create({
  title: "Post image to bog...", 
  contexts: ["image"], 
  onclick: estuary.postimage
})
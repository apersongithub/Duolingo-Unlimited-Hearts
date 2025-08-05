const script = this.document.createElement('script')
script.src = chrome.runtime.getURL("injection.js")
this.document.documentElement.appendChild(script)

// clean it up afterwards
this.document.documentElement.removeChild(script)

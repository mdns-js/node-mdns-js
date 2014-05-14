mDNS-js
==========

Pure JavaScript/NodeJS mDNS discovery implementation

A lot of the functionality is copied from 
https://github.com/GoogleChrome/chrome-app-samples/tree/master/mdns-browser
but adapted for node.

Install by

    npm install mdns-js


example
-------

```javascript
var Mdns = require('mdns-js');

var mdns = new Mdns();

mdns.on('ready', function () {
    mdns.discover(); 
});

mdns.on('update', function () {
    console.log('ips with _workstation._tcp service', mdns.ips('_workstation._tcp')); 
    console.log('services on host 10.100.0.61', mdns.services('10.100.0.61'));
});
```



Debugging
---------
This library is using the [debug](https://github.com/visionmedia/debug) module from TJ Holowaychuk and can be used like this.

```bash
DEBUG=mdns* node examples/simple.js
```

This will spit out a lot of information that might be useful.
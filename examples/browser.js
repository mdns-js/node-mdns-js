/*eslint no-console:0*/
var mdns = require('../');

var TIMEOUT = 5000; //5 seconds

//Set the interface address to listen to. String or array of strings
//mdns.setListenTo('192.168.1.10');
//To only work on IPv6
//mdns.setListenTo('::');
//if undefined it will listen to 0.0.0.0 and :: wich is same as default.
//mdns.setListenTo();

var browser = mdns.createBrowser(); //defaults to mdns.ServiceType.wildcard
//var browser = mdns.createBrowser(mdns.tcp('googlecast'));
//var browser = mdns.createBrowser(mdns.tcp("workstation"));

browser.on('ready', function onReady() {
  console.log('browser is ready');
  browser.discover();
});


browser.on('update', function onUpdate(data) {
  console.log('data:', data);
});

//stop after timeout
setTimeout(function onTimeout() {
  browser.stop();
}, TIMEOUT);

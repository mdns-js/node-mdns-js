var mdns = require('../');

var TIMEOUT = 5000; //5 seconds


var browser = new mdns.createBrowser(); //defaults to mdns.ServiceType.wildcard
//var browser = new mdns.Mdns(mdns.tcp("googlecast"));
//var browser = mdns.createBrowser(mdns.tcp("workstation"));

browser.on('ready', function onReady() {
  console.log('browser is ready');
  browser.discover();
});


browser.on('update', function onUpdate(data) {
  console.log('data:', data);
});

//stop after 5 seconds
setTimeout(function onTimeout() {
  browser.stop();
}, TIMEOUT);

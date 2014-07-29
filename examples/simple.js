var mdns = require('../');

// var browser = new mdns.Mdns(mdns.tcp("googlecast"));
// console.log(mdns.ServiceType.wildcard);
var browser = new mdns.Mdns(mdns.ServiceType.wildcard);

browser.on('ready', function () {
  browser.discover(); 
});

browser.on('update', function (data) {
    console.log('device address', data.addresses[0]); 
    console.log('device name', data.name);
    console.log('service name', data.type);
    mdns.shutdown();
});
var mdns = require('../');


// var browser = new mdns.Mdns(mdns.tcp("googlecast"));
// console.log(mdns.ServiceType.wildcard);
var browser = new mdns.Mdns(mdns.ServiceType.wildcard);

browser.on('ready', function () {
    console.log('browser is ready')
    browser.discover(); 
});


browser.on('update', function (data) {
    var device = {
        address: data.addresses[0],
        name: data.name,
        servicename: data.type
    }
    console.log('device:', data);
});
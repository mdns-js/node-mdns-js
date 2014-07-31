var mdns = require('../');




var browser = new mdns.createBrowser(); //defaults to mdns.ServiceType.wildcard
//var browser = new mdns.Mdns(mdns.tcp("googlecast"));
//var browser = mdns.createBrowser(mdns.tcp("workstation"));

browser.on('ready', function () {
    console.log('browser is ready');
    browser.discover(); 
});


browser.on('update', function (data) {
    
    console.log('data:', data);
});

//stop after 60 seconds
setTimeout(function () {
    browser.stop();
}, 6000);
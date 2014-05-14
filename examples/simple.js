var Mdns = require('../');

var mdns = new Mdns();

mdns.on('ready', function () {
    mdns.discover();
});

mdns.on('update', function () {
    console.log('ips with _workstation._tcp service', mdns.ips('_workstation._tcp')); 
    console.log('services on host 10.100.0.61', mdns.services('10.100.0.61'));
    mdns.shutdown();
});
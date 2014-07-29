var Mdns = require('../'); //change to mdns-js if using library as a module

var mdns = new Mdns();

mdns.on('ready', function () {
    mdns.discover();
});

mdns.on('update', function () {
    var workstations = mdns.ips('_workstation._tcp');
    console.log('ips with _workstation._tcp service', workstations); 

    var services = mdns.services(workstations[0]);
    console.log('services on first workstation host %s: %s', workstations[0], services);
    mdns.shutdown();
});

const Mdns = require('./lib');
const Networking = require('./lib/networking');

module.exports = new Mdns({networking: new Networking()});

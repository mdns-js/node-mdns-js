var config = require('./package.json');
var st = require('./lib/service_type');


module.exports.Mdns = require('./lib');
module.exports.version = config.version;
module.exports.name = config.name;

module.exports.ServiceType = st.ServiceType;
module.exports.makeServiceType = st.makeServiceType;
module.exports.tcp = st.protocolHelper('tcp');
module.exports.udp = st.protocolHelper('udp');


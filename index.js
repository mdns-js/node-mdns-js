var config = require('./package.json');
var st = require('./lib/service_type');

var Browser = module.exports.Browser = require('./lib/browser'); //just for convenience

module.exports.version = config.version;
module.exports.name = config.name;

/**
 * Create a browser instance
 * @param {string} [serviceType] - The Service type to browse for. Defaults to ServiceType.wildcard
 * @return {Browser} 
 */
module.exports.createBrowser = function (serviceType) {
    if (typeof serviceType === 'undefined') {
        serviceType = st.ServiceType.wildcard
    }
    return new Browser(serviceType);
}




module.exports.ServiceType = st.ServiceType;
module.exports.makeServiceType = st.makeServiceType;
module.exports.tcp = st.protocolHelper('tcp');
module.exports.udp = st.protocolHelper('udp');


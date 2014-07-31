

var config = require('./package.json');
var st = require('./lib/service_type');



/** @member {string} */
module.exports.version = config.version;
module.exports.name = config.name;

/* @borrows Browser as Browser */
module.exports.Browser = require('./lib/browser'); //just for convenience

/**
 * Create a browser instance
 * @method
 * @param {string} [serviceType] - The Service type to browse for. Defaults to ServiceType.wildcard
 * @return {Browser} 
 */
module.exports.createBrowser = function (serviceType) {
    if (typeof serviceType === 'undefined') {
        serviceType = st.ServiceType.wildcard
    }
    return new module.exports.Browser(serviceType);
}



/** @property {module:ServiceType~ServiceType} */
module.exports.ServiceType = st.ServiceType;

/** @property {module:ServiceType.makeServiceType} */
module.exports.makeServiceType = st.makeServiceType;

/** @function */
module.exports.tcp = st.protocolHelper('tcp');

/** @function */
module.exports.udp = st.protocolHelper('udp');




var config = require('../package.json');
var st = require('./service_type');


function Mdns(options) {
  this.networking = options.networking;
}

module.exports = Mdns;



/** @member {string} */
module.exports.version = config.version;
module.exports.name = config.name;

/* @borrows Browser as Browser */
var Browser = module.exports.Browser = require('./browser'); //just for convenience
/* @borrows Advertisement as Advertisement */
var Advertisement = module.exports.Advertisement = require('./advertisement'); //just for convenience

/**
 * Create a browser instance
 * @method
 * @param {string} [serviceType] - The Service type to browse for. Defaults to ServiceType.wildcard
 * @return {Browser}
 */
Mdns.prototype.createBrowser = function browserCreated(serviceType) {
  if (typeof serviceType === 'undefined') {
    serviceType = st.ServiceType.wildcard;
  }
  return new Browser(this.networking, serviceType);
};


Mdns.prototype.excludeInterface = function (iface) {
  if (this.networking.started) {
    throw new Error('can not exclude interfaces after start');
  }
  if (iface === '0.0.0.0') {
    this.networking.INADDR_ANY = false;
  }
  else {
    var err = new Error('Not a supported interface');
    err.interface = iface;
  }
};


/**
 * Create a service instance
 * @method
 * @param {string|ServiceType} serviceType - The service type to register
 * @param {number} [port] - The port number for the service
 * @param {object} [options] - ...
 * @return {Advertisement}
 */
Mdns.prototype.createAdvertisement =
  function advertisementCreated(serviceType, port, options) {
    return new Advertisement(
      this.networking, serviceType, port, options);
  };


/** @property {module:ServiceType~ServiceType} */
Mdns.prototype.ServiceType = st.ServiceType;

/** @property {module:ServiceType.makeServiceType} */
Mdns.prototype.makeServiceType = st.makeServiceType;

/** @function */
Mdns.prototype.tcp = st.protocolHelper('tcp');

/** @function */
Mdns.prototype.udp = st.protocolHelper('udp');


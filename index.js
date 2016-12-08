

var config = require('./package.json');
var st = require('./lib/service_type');
var Networking = require('./lib/networking');

var networking = new Networking();

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
module.exports.createBrowser = function browserCreated(serviceType) {
  if (typeof serviceType === 'undefined') {
    serviceType = st.ServiceType.wildcard;
  }
  return new module.exports.Browser(networking, serviceType);
};


module.exports.excludeInterface = function (iface) {
  if (networking.started) {
    throw new Error('can not exclude interfaces after start');
  }
  if (iface === '0.0.0.0' || iface === '::') {
    networking.INADDR_ANY = false;
  }
  else {
    var err = new Error('Not a supported interface');
    err.interface = iface;
  }
};

/**
 * Restrict the network socket to only listen on the respective link local multicast addresses
 * IPv4: 224.0.0.251
 * IPv6: FF02::FB
 * instead of binding the port to all receiving local IP addresses (0.0.0.0 / ::).
 * This is a convenience function to avoid having to manually exclude both address families.
 * @method
 */
module.exports.listenOnLinkLocalMulticastOnly = () => {
  if (networking.started) {
    throw new Error('can not exclude interfaces after start');
  }
  networking.INADDR_ANY = false;
};

/**
 * Enables setting the desired address family
 * @method
 * @param {string} family - String Enum, either 'IPv4', 'IPv6', 'both' or 'any'
 */
module.exports.setAddressFamily = (family) => {
  if (['IPv4', 'IPv6', 'both', 'any'].indexOf(family) === -1) {
    throw new Error('invalid network address family option: ' + family + ", must be either 'IPv4', 'IPv6', 'both' or 'any'");
  }
  networking.ADDR_FAMILY = family;
};

/**
 * Enables setting network options between initialization and starting
 * @method
 * @param {object} options - A configuration object describing the desired network options
 */
module.exports.setNetworkOptions = (options) => {
  if (networking.started) {
    throw new Error('can not set network options after interfaces have been started');
  }
  networking.options = options;
};

/**
 * Enables getting network options
 * @method
 * @return {object} options - A configuration object describing the desired network options
 */
module.exports.getNetworkOptions = () => {
  return networking.options;
};


/* @borrows Advertisement as Advertisement */
module.exports.Advertisement = require('./lib/advertisement'); //just for convenience

/**
 * Create a service instance
 * @method
 * @param {string|ServiceType} serviceType - The service type to register
 * @param {number} [port] - The port number for the service
 * @param {object} [options] - ...
 * @return {Advertisement}
 */
module.exports.createAdvertisement =
  function advertisementCreated(serviceType, port, options) {
    return new module.exports.Advertisement(
      networking, serviceType, port, options);
  };


/** @property {module:ServiceType~ServiceType} */
module.exports.ServiceType = st.ServiceType;

/** @property {module:ServiceType.makeServiceType} */
module.exports.makeServiceType = st.makeServiceType;

/** @property */
module.exports.networking = networking;

/** @function */
module.exports.tcp = st.protocolHelper('tcp');

/** @function */
module.exports.udp = st.protocolHelper('udp');


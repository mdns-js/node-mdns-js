var debug = require('debug')('mdns:lib:ServiceType');
const { ServiceTypeDecodeError } = require('./errors');
const { SERVICE_DESCRIPTIONS } = require('./lists');
/** @module ServiceType */

/*
  Subtypes can be found in section 7.1 of RFC6763
  https://tools.ietf.org/html/rfc6763#section-7.1

  According to RFC6763, subtypes can be any arbitrary utf-8 or ascii string
  and not required to begin with underscore. So leave alone
*/

// https://tools.ietf.org/html/rfc6763#section-7.2
var MAX_SERVICETYPE = 22;
// var MAX_INSTANCENAME = 63;
var MAX_SUBTYPE = 63;
var FORMAT_PART = /[a-zA-Z0-9]+/;
var FORMAT_SERVICETYPE = /_[-a-zA-Z0-9]+/;

/**
 * ServiceType class
 * @class
 */
var ServiceType = exports.ServiceType = function (/* ... */) {
  this.name = '';
  this.protocol = '';
  this.subtypes = [];
  var args;
  if (arguments.length === 1) {
    args = Array.isArray(arguments[0]) ? arguments[0] : [arguments[0]];
  }
  else if (arguments.length > 1) {
    args = Array.prototype.slice.call(arguments);
  }
  if (args) {
    if (args.length === 1) {

      if (typeof args[0] === 'string') {
        this.fromString(args[0]);
      // } else if (Array.isArray(args[0])) {
      //   this.fromArray(args[0]);
      }
      else if (typeof args[0] === 'object') {
        this.fromJSON(args[0]);
      }
      else {
        throw new SyntaxError('argument must be a string, array or object');
      }
    }
    else if (args.length >= 2) {
      this.fromArray(args);
    }
    else { // zero arguments
      // uninitialized ServiceType ... fine with me
    }
  }

  this.description = this.getDescription();
};


ServiceType.wildcard = '_services._dns-sd._udp';

ServiceType.prototype.getDescription = function () {
  var key = this.toString();
  return SERVICE_DESCRIPTIONS[key];
};

ServiceType.prototype.isWildcard = function isWildcard() {
  return this.toString() === ServiceType.wildcard;
};

ServiceType.prototype.toString = function () {
  var typeString = _u(this.name) + '.' + _u(this.protocol);
  if (this.fullyQualified) {
    typeString += '.';
  }
  if (this.subtypes.length > 0) {
    var subtypes = this.subtypes.slice(0); //clone not pointer
    subtypes.unshift(typeString);
    typeString = subtypes.join(',');
  }
  return typeString;
};

ServiceType.prototype.fromString = function fromString(text) {
  debug('fromString', text);
  // text = text.replace(/.local$/, '');

  //take care of possible empty subtypes
  if (text.charAt(0) === '_') {
    text = text.replace(/^_sub/, '._sub'); //fix for bad apple
  }

  // if (text.charAt(0) !== '_' && text.indexOf('_sub') === -1) {
  //   throw new ServiceTypeDecodeError('Wrong leading character', text);
  // }

  var isWildcard = text === ServiceType.wildcard;
  var subtypes = text.split(',');

  debug('subtypes', subtypes);
  if (subtypes.length === 1) {
    subtypes = text.split('._sub').reverse();
  }

  var primaryString = subtypes.shift();
  var serviceTokens = primaryString.split('.');
  var serviceType = serviceTokens.shift();
  var protocol;


  debug('primary: %s, servicetype: %s, serviceTokens: %s, subtypes: %j',
    primaryString, serviceType, serviceTokens.join('.'), subtypes.join(','));

  if (isWildcard) {
    serviceType += '.' + serviceTokens.shift();
  }
  if (primaryString[0] !== '_' || primaryString[0] === '_services') {
    serviceType = serviceTokens.shift();
  }

  protocol = serviceTokens.shift();
  //make tcp default if not already defined
  if (typeof protocol === 'undefined') {
    protocol = '_tcp';
  }
  checkProtocolU(protocol);
  if (!isWildcard) {
    checkLengthAndFormat(serviceType, MAX_SERVICETYPE, FORMAT_SERVICETYPE);
  }

  if (serviceTokens.length === 1 && serviceTokens[0] === '') {
    // trailing dot
    this.fullyQualified = true;
  }
  else if (serviceTokens.length > 0) {
    // this should be a parent domain in DNS-SD
    this.parentdomain = serviceTokens.join('.');
  }

  this.name = serviceType.substr(1);
  this.protocol = protocol.substr(1);
  this.subtypes = subtypes; //subtypes.map(function (t) { return t.substr(1); });

  debug('this', this);
};

ServiceType.prototype.toArray = function toArray() {
  return [this.name, this.protocol].concat(this.subtypes);
};

ServiceType.prototype.fromArray = function fromArray(array) {
  var serviceType = _uu(array.shift());
  var protocol = _uu(array.shift());
  var subtypes = array.map(function (t) { return _uu(t); });

  checkLengthAndFormat(serviceType, MAX_SERVICETYPE, FORMAT_PART);
  checkProtocol(protocol);
  subtypes.forEach(function (t) { checkLengthAndFormat(t, MAX_SUBTYPE, FORMAT_PART); });

  this.name = serviceType;
  this.protocol = protocol;
  this.subtypes = subtypes;
};

ServiceType.prototype.fromJSON = function fromJSON(obj) {
  debug('fromJSON');
  if (!('name' in obj)) {
    throw new SyntaxError('required property name is missing');
  }
  if (!('protocol' in obj)) {
    throw new SyntaxError('required property protocol is missing');
  }

  var serviceType    = _uu(obj.name);
  var protocol       = _uu(obj.protocol);
  var subtypes       = ('subtypes' in obj ?
    obj.subtypes.map(function (t) { return _uu(t); }) : []);

  var parentdomain   = obj.parentdomain;

  checkLengthAndFormat(serviceType, MAX_SERVICETYPE, FORMAT_PART);
  checkProtocol(protocol);
  subtypes.forEach(function (t) { checkLengthAndFormat(t, MAX_SUBTYPE, FORMAT_PART); });

  this.name = serviceType;
  this.protocol = protocol;
  this.subtypes = subtypes;
  if ('fullyQualified' in obj) {
    this.fullyQualified = obj.fullyQualified;
  }
  if (parentdomain) {
    this.parentdomain = parentdomain;
  }
};

ServiceType.prototype.matches = function matches(other) {
  return this.name === other.name && this.protocol === other.protocol;
  // XXX handle subtypes
};

/**
 * creates a service type
 * @method
 * @returns {ServiceType}
 */
exports.makeServiceType = function makeServiceType() {
  if (arguments.length === 1 && arguments[0] instanceof ServiceType) {
    return arguments[0];
  }
  return new ServiceType(Array.prototype.slice.call(arguments));
};


/**
 * create protocol helpers
 * @param {string} protocol - tcp or udp
 * @returns {ServiceType}
 */
exports.protocolHelper = function protocolHelper(protocol) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    if (isProtocol(args[1])) {
      throw new SyntaxError('duplicate protocol "' + args[1] + '" in arguments');
    }
    args.splice(1, 0, protocol);
    return exports.makeServiceType.apply(this, args);
  };
};


function isProtocol(str) {
  return str === 'tcp' || str === '_tcp' || str === 'udp' || str === '_udp';
}

function _u(str) { return '_' + str; }
function _uu(str) { return str[0] === '_' ? str.substr(1) : str; }


function checkLengthAndFormat(str, maxLength, format) {
  if (str.length === 0) {
    throw new ServiceTypeDecodeError('type ' + str + ' must not be empty');
  }
  if (str.length > maxLength) {
    throw new ServiceTypeDecodeError('type ' + str + ' has more than ' +
    maxLength + ' characters');
  }
  if (!str.match(format)) {
    throw new ServiceTypeDecodeError('type ' + str + ' has wrong format');
  }
}


function checkProtocolU(str) {
  if (!(str === '_tcp' || str === '_udp')) {
    throw new ServiceTypeDecodeError('protocol must be either "_tcp" or "_udp" but is "' +
        str + '"');
  }
}

function checkProtocol(str) {
  if (!(str === 'tcp' || str === 'udp')) {
    throw new ServiceTypeDecodeError('protocol must be either "tcp" or "udp" but is "' +
        str + '"');
  }
}

// This list is based on /usr/share/avahi/service-types.


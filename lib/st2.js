const WILDCARD = '_services._dns-sd._udp';
const { SERVICE_DESCRIPTIONS } = require('./lists');
const { ServiceTypeDecodeError, MdnsValidationError } = require('./errors');

const ALLOWED_PROTOCOLS = ['_tcp', '_udp'];
/**
 * Prepends str with underscore '_'
 * @param {string} str
 * @returns '_' + str
 */
function _u(str) { return '_' + str; }

/**
 * Removes optional leading underscore
 * @param {string} str
 * @returns {string}
 */
function _uu(str) { return str[0] === '_' ? str.substr(1) : str; }


class ServiceType {
  constructor() {
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
  }// constructor

  get isWildcard() {
    return this.toString() === WILDCARD;
  }

  getDescription() {
    var key = this.toString();
    return SERVICE_DESCRIPTIONS[key];
  }

  validate() {
    if (this.protocol === '' && this.name === '' && this.subtypes.length === 0) {
      return;
    }
    // test protocol and name according to https://tools.ietf.org/html/rfc6763#section-7
    if (ALLOWED_PROTOCOLS.indexOf(`_${this.protocol}`) < 0) {
      throw new MdnsValidationError('protocol', this.protocol);
    }

    // test for length
    if (this.name.length < 1 || this.name.length > 15) {
      throw new MdnsValidationError('name', this.name);
    }

    // test for beginning and content and end
    if (!this.name.match(/^[\w\d][\w\d-]*[\w\d]$/) ) {
      throw new MdnsValidationError('name', this.name);
    }

  }

  fromString(text) {
    let subtypes = [];

    // take care of comma separated subtypes
    if (text.indexOf(',') >= 0) {
      const parts = text.split(',');
      text = parts[0];
      subtypes = parts.slice(1);
    }

    var names = text.split('.').reverse();

    let domain = '';
    while (names && names.length >= 1 && names[0].charAt(0) !== '_') {
      domain = names.shift() + (domain !== '' ? '.' + domain : domain);
    }
    if (domain) {
      this.parentdomain = domain;
    }

    // default to _tcp if missing
    if (names.length > 1 && ALLOWED_PROTOCOLS.indexOf(names[0]) < 0) {
      throw new ServiceTypeDecodeError(`protocol must be either "_tcp" or "_udp" but is "${names[0]}"`);
    }
    const transport = ALLOWED_PROTOCOLS.indexOf(names[0]) >= 0 ? names.shift() : '_tcp';

    let serviceName = '';
    while (names && names.length >= 1 && names[0].charAt(0) === '_' && names[0] !== '_sub') {
      serviceName = names.shift() + (serviceName !== '' ? '.' + serviceName : serviceName);
    }
    if (names.length >= 1 && names[0] === '_sub') {
      names.shift(); // remove the _sub
      if (names.length === 0) {
        // apple can sometimes send empty subtypes
        subtypes.push('');
      }
      while (names.length >= 1) {
        subtypes.push(names.shift());
      }
    }
    // const serviceName = names.reverse().join('.');
    if (serviceName === '' && names.length > 0) {
      serviceName = names.join('.');
    }

    this.subtypes = subtypes;
    this.name = _uu(serviceName);
    this.protocol = _uu(transport);
    this.validate();
  }

  fromArray(array) {
    var serviceType = _uu(array.shift());
    var protocol = _uu(array.shift());
    var subtypes = array.map(function (t) { return _uu(t); });

    // checkLengthAndFormat(serviceType, MAX_SERVICETYPE, FORMAT_PART);
    // checkProtocol(protocol);
    // subtypes.forEach(function (t) { checkLengthAndFormat(t, MAX_SUBTYPE, FORMAT_PART); });

    this.name = serviceType;
    this.protocol = protocol;
    this.subtypes = subtypes;
    this.validate();
  }

  fromJSON(obj) {
    // debug('fromJSON');
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

    // checkLengthAndFormat(serviceType, MAX_SERVICETYPE, FORMAT_PART);
    // checkProtocol(protocol);
    // subtypes.forEach(function (t) { checkLengthAndFormat(t, MAX_SUBTYPE, FORMAT_PART); });

    this.name = serviceType;
    this.protocol = protocol;
    this.subtypes = subtypes;
    if ('fullyQualified' in obj) {
      this.fullyQualified = obj.fullyQualified;
    }
    if (parentdomain) {
      this.parentdomain = parentdomain;
    }
    this.validate();
  }

  toString() {
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
  }

  toArray() {
    return [this.name, this.protocol].concat(this.subtypes);
  }

}

ServiceType.wildcard = WILDCARD;


module.exports = {
  WILDCARD,
  ServiceType
};

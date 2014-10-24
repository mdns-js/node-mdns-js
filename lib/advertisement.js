
var debug = require('debug')('mdns:advertisement');
var dgram = require('dgram');
var os = require('os');

var DNSPacket = require('./dnspacket');
var DNSRecord = require('./dnsrecord');

var internal = {};

internal.buildDNSPacket = function (ttl) {
  var packet =
    new DNSPacket(DNSPacket.Flag.RESPONSE | DNSPacket.Flag.AUTHORATIVE);
  var name = this.options.name;
  var domain = this.options.domain || 'local';
  var target = name;
  if ('host' in this.options) {
    target = this.options.host;
  }
  target += '.' + domain;
  var serviceType = this.serviceType.toString() + '.' + domain;
  var alias = name + '.' + serviceType;

  debug('alias:', alias);

  packet.push('an', new DNSRecord(
    serviceType, DNSRecord.Type.PTR, 1, ttl,
    DNSRecord.toName(alias)));

  packet.push('an', new DNSRecord(
    alias, DNSRecord.Type.SRV, 1, ttl,
    DNSRecord.toSrv(0, 0, this.port, target)));

  if ('txt' in this.options) {
    packet.push('an', new DNSRecord(
      alias, DNSRecord.Type.TXT, 1, ttl,
      DNSRecord.toTxt(this.options.txt)));
  }

  var interfaces = os.networkInterfaces();
  var ifaceFilter = this.options.networkInterface;
  for (var key in interfaces) {
    if (typeof ifaceFilter === 'undefined' || key === ifaceFilter) {
      debug('add A record for interface:' , key);
      for (var i = 0; i < interfaces[key].length; i++) {
        var address = interfaces[key][i].address;
        if (address.indexOf(':') === -1) {
          packet.push('an', new DNSRecord(
            target, DNSRecord.Type.A, 1, ttl,
            DNSRecord.toA(address)));
        } else {
          // TODO: also publish the ip6_address in an AAAA record
        }
      }
    }
  }
  return packet;
};

internal.sendDNSPacket = function (packet) {
  var buf = packet.toBuffer();

  // send packet
  var sock = dgram.createSocket('udp4');
  sock.bind(5353, function (err) {
    if (err) {
      debug('there was an error binding %s', err);
      return;
    }
    sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
      debug('sent %d bytes with err:%s', bytes, err);
      sock.close();
    });
  });
};

/**
 * mDNS Advertisement class
 * @class
 * @param {string|ServiceType} serviceType - The service type to register
 * @param {number} [port] - The port number for the service
 * @param {object} [options] - ...
 */
var Advertisement = module.exports = function (serviceType, port, options) {
  if (!(this instanceof Advertisement)) {
    return new Advertisement(serviceType, port, options);
  }

  // TODO: check more parameters
  if (!('name' in options)) {
    throw new Error('options must contain the name field.');
  }
  this.serviceType = serviceType;
  this.port = port;
  this.options = options;
  debug('created new service');
}; //--Advertisement constructor

Advertisement.prototype.start = function () {
  debug('publishing service');
  internal.sendDNSPacket(internal.buildDNSPacket.apply(this, [DNSRecord.TTL]));
};

Advertisement.prototype.stop = function () {
  debug('unpublishing service');
  internal.sendDNSPacket(internal.buildDNSPacket.apply(this, [0]));
};

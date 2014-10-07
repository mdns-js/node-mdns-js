
var debug = require('debug')('mdns:advertisement');
var dgram = require('dgram');

var DNSPacket = require('./dnspacket');
var DNSRecord = require('./dnsrecord');

var internal = {};

internal.buildDNSPacket = function (ttl) {
  var packet =
    new DNSPacket(DNSPacket.Flag.RESPONSE | DNSPacket.Flag.AUTHORATIVE);
  var name = this.options.name;
  var address = name + '.local';
  if ('host' in this.options) {
    address = this.options.host;
  }
  var serviceType = this.serviceType.toString() + '.local';
  var alias = name + '.' + serviceType;

  debug('serviceType:', serviceType);

  packet.push('an', new DNSRecord(
    serviceType, DNSRecord.Type.PTR, 1, ttl,
    DNSRecord.toName(alias)));

  packet.push('an', new DNSRecord(
    alias, DNSRecord.Type.SRV, 1, ttl,
    DNSRecord.toSrv(0, 0, this.port, address)));

  if ('txt' in this.options) {
    packet.push('an', new DNSRecord(
      alias, DNSRecord.Type.TXT, 1, ttl,
      DNSRecord.toTxt(this.options.txt)));
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
  setTimeout(function onTimeout() {
    this.start();
  }.bind(this), DNSRecord.TTL * 950); // TTL is seconds, need ms
};

Advertisement.prototype.stop = function () {
  debug('unpublishing service');
  internal.sendDNSPacket(internal.buildDNSPacket.apply(this, [0]));
};

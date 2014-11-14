
var debug = require('debug')('mdns:advertisement');
var dgram = require('dgram');
var os = require('os');

var DNSPacket = require('./dnspacket');
var DNSRecord = require('./dnsrecord');
var ServiceType = require('./service_type').ServiceType;

var internal = {};

internal.buildQDPacket = function () {
  var packet = new DNSPacket();
  var name = this.options.name + this.nameSuffix;
  var domain = this.options.domain || 'local';
  var serviceType = this.serviceType.toString() + '.' + domain;
  this.alias = name + '.' + serviceType;

  packet.push('qd', new DNSRecord(this.alias, DNSRecord.Type.ANY, 1));
  return packet;
};

internal.buildANPacket = function (ttl) {
  var packet =
    new DNSPacket(DNSPacket.Flag.RESPONSE | DNSPacket.Flag.AUTHORATIVE);
  var name = this.options.name + this.nameSuffix;
  var domain = this.options.domain || 'local';
  var target = (this.options.host || name) + '.' + domain;
  var serviceType = this.serviceType.toString() + '.' + domain;
  var cl = DNSRecord.Class.IN | DNSRecord.Class.FLUSH;

  debug('alias:', this.alias);

  packet.push('an', new DNSRecord(
    serviceType, DNSRecord.Type.PTR, cl, ttl, DNSRecord.toName(this.alias)));

  packet.push('an', new DNSRecord(
    this.alias, DNSRecord.Type.SRV, cl, ttl,
    DNSRecord.toSrv(0, 0, this.port, target)));

  // TODO: https://github.com/agnat/node_mdns/blob/master/lib/advertisement.js
  // has 'txtRecord'
  if ('txt' in this.options) {
    packet.push('an', new DNSRecord(
      this.alias, DNSRecord.Type.TXT, cl, ttl,
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
            target, DNSRecord.Type.A, cl, ttl, DNSRecord.toA(address)));
        } else {
          // TODO: also publish the ip6_address in an AAAA record
        }
      }
    }
  }
  return packet;
};

internal.sendDNSPacket = function (packet, cb) {
  var buf = packet.toBuffer();

  // send packet
  var sock = dgram.createSocket('udp4');
  sock.bind(5353, function (err) {
    if (err) {
      debug('there was an error binding %s', err);
      return;
    }
    sock.setMulticastTTL(255);
    sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
      debug('sent %d bytes with err:%s', bytes, err);
      sock.close();
      typeof cb === 'function' && cb();
    });
  });
};

// Array of published services.
internal.services = [];
// Array of pending probes.
internal.probes = [];
// Array of open sockets
internal.connections = [];

internal.haveResponder = function () {
  return (internal.services.length !== 0 || internal.probes.length !== 0);
};

internal.startResponder = function () {
  var interfaces = os.networkInterfaces();
  var index = 0;
  for (var key in interfaces) {
    if (interfaces.hasOwnProperty(key)) {
      for (var i = 0; i < interfaces[key].length; i++) {
        var address = interfaces[key][i].address;
        debug('interface', key, interfaces[key]);
        //no IPv6 addresses
        if (address.indexOf(':') !== -1) {
          continue;
        }
        // these are for unicast queries ?
        createSocket(index++, key, address, 0, bindToAddress.bind(this));
      }
    }
  }
  // this is for multicast queries ?
  createSocket(index++, key, '224.0.0.251', 5353, bindToAddress.bind(this));

  function createSocket(interfaceIndex, networkInterface, address, port, cb) {
    var sock = dgram.createSocket('udp4');
    debug('creating socket for interface %s', address);
    sock.bind(port, address, function (err) {
      cb(err, interfaceIndex, networkInterface, sock);
    });
  }

  function bindToAddress (err, interfaceIndex, networkInterface, sock) {
    if (err) {
      debug('there was an error binding %s', err);
      return;
    }
    debug('bindToAddress');
    internal.connections.push(sock);

    sock.on('message', function (message, remote) {
      debug('got packet from remote', remote);
      var packet;
      try {
        packet = DNSPacket.parse(message);
      } catch (err) {
        debug('got packet truncated package, ignoring');
        return;
      }

      // check if it is a query where we are the authority for
      packet.each('qd', handleQuery.bind(this));
      packet.each('an', handleAnswer.bind(this));
    }.bind(this));

    sock.on('error', function (err) {
      debug('socket error', err);
    });
  }

  function handleQuery(rec) {
    if (rec.type !== DNSRecord.Type.PTR &&
      rec.type !== DNSRecord.Type.ANY) {
      debug('skipping query: type not PTR/ANY');
      return;
    }
    // check if we should reply via multi or unicast
    // TODO: handle the is_qu === true case and reply directly to remote
    // var is_qu = (rec.cl & DNSRecord.Class.IS_QM) === DNSRecord.Class.IS_QM;
    rec.cl &= ~DNSRecord.Class.IS_OM;
    if (rec.cl !== DNSRecord.Class.IN && rec.type !== DNSRecord.Class.ANY) {
      debug('skipping query: class not IN/ANY');
      return;
    }
    try {
      var type = new ServiceType(rec.name);
      internal.services.forEach(function (service) {
        if (type.isWildcard() || type.matches(service.serviceType)) {
          debug('answering query');
          // TODO: should we only send PTR records if the query was for PTR
          // records?
          internal.sendDNSPacket(
            internal.buildANPacket.apply(service, [DNSRecord.TTL]));
        } else {
          debug('skipping query; type %s not * or %s', type,
              service.serviceType);
        }
      });
    } catch (err) {
      // invalid service type
    }
  }

  function handleAnswer(rec) {
    try {
      internal.probes.forEach(function (service) {
        if (service.status < 3) {
          var conflict = false;
          // parse answers and check if they match a probe
          debug('check names: %s and %s', rec.name, service.alias);
          switch (rec.type) {
            case DNSRecord.Type.PTR:
              if (rec.asName() === service.alias) {
                conflict = true;
                debug('name conflict in PTR');
              }
              break;
            case DNSRecord.Type.SRV:
            case DNSRecord.Type.TXT:
              if (rec.name === service.alias) {
                conflict = true;
                debug('name conflict in SRV/TXT');
              }
              break;
          }
          if (conflict) {
            // no more probes
            service.status = 4;
          }
        }
      });
    } catch (err) {
      // invalid service type
    }
  }
};

internal.stopResponder = function () {
  debug('stopping %d sockets', internal.connections.length);
  for (var i = 0; i < internal.connections.length; i++) {
    var sock = internal.connections[i];
    sock.close();
    sock.unref();
  }
  internal.connections = [];
};

internal.probeAndAdvertise = function () {
  switch (this.status) {
    case 0:
    case 1:
    case 2:
      debug('probing service %d', this.status + 1);
      internal.sendDNSPacket(internal.buildQDPacket.apply(this, []));
      break;
    case 3:
      debug('publishing service, suffix=%s', this.nameSuffix);
      internal.sendDNSPacket(
        internal.buildANPacket.apply(this, [DNSRecord.TTL]));
      // Repost announcement after 1sec (see rfc6762: 8.3)
      setTimeout(function onTimeout() {
        internal.sendDNSPacket(
          internal.buildANPacket.apply(this, [DNSRecord.TTL]));
      }.bind(this), 1000);
      // Service has been registered, repond to matching queries
      internal.services.push(this);
      internal.probes =
        internal.probes.filter(function (service) { return service === this; });
      break;
    case 4:
      // we had a conflict
      if (this.nameSuffix === '') {
        this.nameSuffix = '1';
      } else {
        this.nameSuffix = (parseInt(this.nameSuffix) + 1) + '';
      }
      this.status = -1;
      break;
  }
  if (this.status < 3) {
    this.status++;
    setTimeout(internal.probeAndAdvertise.bind(this), 250);
  }
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
  this.nameSuffix = '';
  this.alias = '';
  this.status = 0; // inactive
  debug('created new service');
}; //--Advertisement constructor

Advertisement.prototype.start = function () {
  if (!internal.haveResponder()) {
    internal.startResponder.apply(this, []);
  }
  internal.probes.push(this);
  internal.probeAndAdvertise.apply(this, []);
};

Advertisement.prototype.stop = function () {
  debug('unpublishing service');
  internal.services =
    internal.services.filter(function (service) { return service === this; });
  if (!internal.haveResponder()) {
    internal.stopResponder.apply(this, []);
  }
  internal.sendDNSPacket(internal.buildANPacket.apply(this, [0]));
  this.nameSuffix = '';
  this.alias = '';
  this.status = 0; // inactive
};

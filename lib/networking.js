var debug = require('debug')('mdns:lib:networking');
var debuginbound = require('debug')('mdns:inbound');
var debugoutbound = require('debug')('mdns:outbound');

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram = require('dgram');
var semver = require('semver');

var dns = require('dns-js');
var DNSPacket = dns.DNSPacket;
//var DNSRecord = dns.DNSRecord;

var MDNS_MULTICAST_IPV4 = '224.0.0.251';
var MDNS_MULTICAST_IPV6 = 'FF02::FB';

var MDNS_PORT = 5353;
var INADDR_ANY_IPV4 = '0.0.0.0';
var INADDR_ANY_IPV6 = '::';

var ANYS = [INADDR_ANY_IPV4];
if (process.platform !== 'darwin') {
  ANYS = [INADDR_ANY_IPV4, INADDR_ANY_IPV6];
}


var Networking = module.exports = function (options) {
  this.options = options || {};
  this.created = 0;
  this.connections = [];
  this.started = false;
  this.users = [];
  this.options.listen = this.options.listen || ANYS.slice(0);
};

util.inherits(Networking, EventEmitter);

Networking.prototype.setListenTo = function (addr) {
  if (typeof addr === 'undefined') {
    addr = ANYS.slice(0);
  }
  if (typeof addr === 'string') {
    addr = [addr];
  }
  if (!(addr instanceof Array)) {
    throw new TypeError('parameter must be string or array of strings');
  }
  this.options.listen = addr;
  debug('setListenTo', this.options.listen);
};

Networking.prototype.start = function () {
  debug('starting networking');
  var index = 0;
  for (var i = 0; i < this.options.listen.length; i++) {
    var address = this.options.listen[i];
    this.createSocket(index++, address,
      address, MDNS_PORT, this.bindToAddress.bind(this));
  }
};


Networking.prototype.stop = function () {
  debug('stopping');

  this.connections.forEach(closeEach);
  this.connections = [];
  this.created = 0;
  this.started = false;

  function closeEach(connection) {
    var socket = connection.socket;
    socket.close();
    socket.unref();
  }
};


Networking.prototype.createSocket = function (
  interfaceIndex, networkInterface, address, port, next) {
  var sock;
  var multicastInterface;
  var multicastAddress = MDNS_MULTICAST_IPV4;
  var sockType = 'udp4';
  var bindAddress = address;

  if (address.indexOf('::') >= 0) {
    sockType = 'udp6';
    multicastAddress = MDNS_MULTICAST_IPV6;
    if (process.platform === 'darwin') {
      throw new Error('IPv6 not yet working');
    }
  }
  debug('creating socket type %s', sockType);
  if (semver.gte(process.versions.node, '0.11.13')) {
    sock = dgram.createSocket({type:sockType, reuseAddr:true});
  }
  else {
    sock = dgram.createSocket(sockType);
  }

  this.created++;

  sock.on('error', function (err) {
    next(err, interfaceIndex, networkInterface, sock);
  });

  var IADDR_ANY = false;
  if (ANYS.indexOf(address) === -1) {
    if (process.platform === 'win32') {
      multicastInterface = address;
    }
  }
  else {
    IADDR_ANY = true;
  }

  function bound(err) {
    if ((!err)) {
      debug('adding membership to "%s" on "%s" interface', multicastAddress, multicastInterface);
      sock.addMembership(multicastAddress, multicastInterface);
      sock.setMulticastTTL(255);
      sock.setMulticastLoopback(true);
      sock.setBroadcast(true);
    }
    next(err, interfaceIndex, networkInterface, sock);
  }

  if (IADDR_ANY) {
    debug('binding socket for IPADDR_ANY to port %s', port);
    sock.bind(port, bound);
  }
  else {
    debug('binding socket for %s to port %s', bindAddress, port);
    sock.bind(port, bindAddress, bound);
  }
};


Networking.prototype.bindToAddress = function (err, interfaceIndex, networkInterface, sock) {
  if (err) {
    debug('there was an error binding %s', err);
    return;
  }
  debug('bindToAddress', networkInterface);
  var info = sock.address();

  var connection = {
    socket:sock,
    interfaceIndex: interfaceIndex,
    networkInterface: networkInterface,
    counters: {
      sent: 0,
      received: 0
    }
  };

  this.connections.push(connection);
  var self = this;

  sock.on('message', function (message, remote) {
    var packets;
    connection.counters.received++;
    debuginbound(remote.address || remote, message.toString('hex'));
    try {
      packets = dns.DNSPacket.parse(message);
      if (!(packets instanceof Array)) {
        packets = [packets];
      }
    }
    catch (er) {
      //partial, skip it
      debug('packet parsing error', er);
      return;
    }

    self.emit('packets', packets, remote, connection);
  });

  sock.on('error', self.onError.bind(self));

  sock.on('close', function () {
    debug('socket closed', info);
  });


  if (this.created === this.connections.length) {
    this.emit('ready', this.connections.length);
  }
};//--bindToAddress


Networking.prototype.onError = function (err) {
  this.emit('error', err);
};


Networking.prototype.send = function (packet) {
  var buf = DNSPacket.toBuffer(packet);
  this.connections.forEach(onEach);
  debug('created buffer with length', buf.length);
  debugoutbound('message', buf.toString('hex'));
  function onEach(connection) {
    var sock = connection.socket;
    var multicastAddress = sock.address().family === 'IPv4' ? MDNS_MULTICAST_IPV4 : MDNS_MULTICAST_IPV6;
    debug('sending to %s on interface', multicastAddress, sock.address());
    sock.send(buf, 0, buf.length, MDNS_PORT, multicastAddress, function (err, bytes) {
      connection.counters.sent++;
      debug('%s sent %d bytes with err:%s', sock.address().address, bytes,
          err);
    });
  }
};

Networking.prototype.startRequest = function (callback) {
  if (this.started) {
    return process.nextTick(callback());
  }
  this.start();
  this.once('ready', function () {
    if (typeof callback === 'function') {
      callback();
    }
  });
};


Networking.prototype.stopRequest = function () {
  if (this.users.length === 0) {
    this.stop();
  }
};


Networking.prototype.addUsage = function (browser, next) {
  this.users.push(browser);
  this.startRequest(next);
};


Networking.prototype.removeUsage = function (browser) {
  var index = this.users.indexOf(browser);
  if (index > -1) {
    this.users.splice(index, 1);
  }
  // TODO should also clear stale state out of addresses table
  this.connections.forEach(function (c) {
    if (c.services && c.services[browser.serviceType.toString()]) {
      delete c.services[browser.serviceType.toString()];
    }
  });
  this.stopRequest();
};

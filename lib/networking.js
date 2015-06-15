var debug = require('debug')('mdns:lib:networking');
var debuginbound = require('debug')('mdns:inbound');
var debugoutbound = require('debug')('mdns:outbound');

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var os = require('os');
var dgram = require('dgram');
var semver = require('semver');

var dns = require('mdns-js-packet');
var DNSPacket = dns.DNSPacket;
//var DNSRecord = dns.DNSRecord;

var MDNS_MULTICAST = '224.0.0.251';


var Networking = module.exports = function (options) {
  options = options || {};
  this.created = 0;
  this.connections = [];
  // list of ips to add membership for
  this.ips = [];
  this.started = false;
  this.users = [];
  this.INADDR_ANY = typeof options.INADDR_ANY === 'undefined' ?
    false : options.INADDR_ANY;
};

util.inherits(Networking, EventEmitter);


Networking.prototype.start = function () {
  var interfaces = os.networkInterfaces();
  var index = 0;
  for (var key in interfaces) {
    if (interfaces.hasOwnProperty(key)) {
      for (var i = 0; i < interfaces[key].length; i++) {
        var iface = interfaces[key][i];
        //no localhost
        if (iface.internal) {
          continue;
        }
        //no IPv6 addresses
        if (iface.address.indexOf(':') !== -1) {
          continue;
        }
        debug('interface', key, iface.address);
        this.createSocket(index++, key,
          iface.address, 0, this.bindToAddress.bind(this));
        if (this.ips.indexOf(iface.address) === -1) {
          this.ips.push(iface.address);
        }
      }
    }
  }
  // apple-tv always replies back using multicast,
  // regardless of the source of the query, it is answering back.
  this.createSocket(index++, 'pseudo multicast',
    '0.0.0.0', 5353, this.bindToAddress.bind(this));
  if (this.ips.length > 1) {
    // There is no way ( at least in node.js ) to listen ( or send )
    // to multicast on an interface other than the one, kernel had chosen.
    // so on a multihommed device, despite all these efforts, we never find devices
    // on other interfaces.
    debug('***Warning This is a multihommed device.***');
  }
};


Networking.prototype.stop = function () {
  debug('stopping');

  this.connections.forEach(closeEach);
  this.connections = [];

  function closeEach(connection) {
    var socket = connection.socket;
    socket.close();
    socket.unref();
  }
};


Networking.prototype.createSocket = function (
  interfaceIndex, networkInterface, address, port, next) {
  var sock;
  var ips_ = this.ips;
  if (semver.gte(process.versions.node, '0.11.13')) {
    sock = dgram.createSocket({type:'udp4', reuseAddr:true});
  } else {
    sock = dgram.createSocket('udp4');
  }
  debug('creating socket for', networkInterface);
  this.created++;

  sock.bind(port, address, function () {
    if (address === '0.0.0.0' && port === 5353) {
      if (semver.gte(process.versions.node, '0.11.13')) {
        for (var i = 0; i < ips_.length;i++) {
          sock.addMembership(MDNS_MULTICAST,ips_[i]);
        }
      } else {
        sock.addMembership(MDNS_MULTICAST);
      }
      sock.setMulticastTTL(255);
      sock.setMulticastLoopback(true);
    }
    next(null, interfaceIndex, networkInterface, sock);
  });

};


Networking.prototype.bindToAddress = function (
  err, interfaceIndex, networkInterface, sock) {
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
    debuginbound('incomming message', message.toString('hex'));
    try {
      packets = dns.DNSPacket.parse(message);
      if (!(packets instanceof Array)) {
        packets = [packets];
      }

      self.emit('packets', packets, remote, connection);
    }
    catch (err) {
      //partial, skip it
      debug('packet parsing error', err);
    }
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
    // if the user did not specially asked for the pseudo interface
    // skip sending message on that interface.
    if (sock.address().address === '0.0.0.0' && !this.INADDR_ANY) {
      debug('skip send on pseudo interface.');
    } else {
      debug('sending to', sock.address());

      sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
        connection.counters.sent++;
        debug('%s sent %d bytes with err:%s', sock.address().address, bytes,
            err);
      });
    }
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
  this.stopRequest();
};


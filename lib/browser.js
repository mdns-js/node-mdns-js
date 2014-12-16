
var debug = require('debug')('mdns:browser');
var debugpacket = require('debug')('mdns:browser:packet');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram = require('dgram');
var os = require('os');
//var helper = require('../test/helper');

var dns = require('mdns-js-packet');
var DNSPacket = dns.DNSPacket;
var DNSRecord = dns.DNSRecord;
var ServiceType = require('./service_type').ServiceType;
var decoder = require('./decoder');
// var counter = 0;
var internal = {};

var MDNS_MULTICAST = '224.0.0.251';


internal.broadcast = function (sock, serviceType) {
  debug('broadcasting to', sock.address());
  var packet = new DNSPacket();
  packet.question.push(new DNSRecord(
    serviceType.toString() + '.local',
    DNSRecord.Type.PTR, 1)
  );
  var buf = DNSPacket.toBuffer(packet);
  debug('created buffer with length', buf.length);
  sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
    debug('%s sent %d bytes with err:%s', sock.address().address, bytes, err);
  });
};

/**
 * Handles incoming UDP traffic.
 * @private
 */
internal.onMessage = function (message, remote, connection) {
  debug('got packet from remote', remote);
  debugpacket('incomming packet', message.toString('hex'));
  var data = decoder.decodeMessage(message);
  var isNew = false;

  function setNew(/*msg*/) {
    isNew = true;
    debug('new on %s, because %s',
      connection.networkInterface, util.format.apply(null, arguments));
  }

  function updateValue(src, dst, name) {
    if (JSON.stringify(dst[name]) !== JSON.stringify(src)) {
      setNew('updated host.%s', name);
      dst[name] = src;
    }
  }

  function addValue(src, dst, name) {
    if (typeof dst[name] === 'undefined') {
      setNew('added host.%s', name);
      dst[name] = src;
    }
  }

  if (data) {

    data.interfaceIndex = connection.interfaceIndex;
    data.networkInterface = connection.networkInterface;
    data.addresses.push(remote.address);
    if (!connection.services) {
      connection.services = {};
    }

    if (!connection.addresses) {
      connection.addresses = {};
    }


    if (typeof data.type !== 'undefined') {
      data.type.forEach(function (type) {
        var service;
        var serviceKey = type.toString();
        if (!connection.services.hasOwnProperty(serviceKey)) {
          setNew('new service - %s', serviceKey);
          service = connection.services[serviceKey] = {
            type: type, addresses: []
          };
        }
        else {
          service = connection.services[serviceKey];
        }

        data.addresses.forEach(function (adr) {
          if (service.addresses.indexOf(adr) === -1) {
            service.addresses.push(adr);
            setNew('new address');
          }

          var host;
          if (connection.addresses.hasOwnProperty(adr)) {
            host = connection.addresses[adr];
          }
          else {
            host = connection.addresses[adr] = {address: adr};
            setNew('new host');
          }
          addValue({}, host, serviceKey);
          updateValue(data.port, host[serviceKey], 'port');
          updateValue(data.host, host[serviceKey], 'host');
          updateValue(data.txt, host[serviceKey], 'txt');
        });
      });
    }


    /**
     * Update event
     * @event Browser#update
     * @type {object}
     * @property {string} networkInterface - name of network interface
     * @property {number} interfaceIndex
     */
    debug('isNew', isNew);
    if (isNew && data) {
      this.emit('update', data);
    }
  }
};

/**
 * mDNS Browser class
 * @class
 * @param {string|ServiceType} serviceType - The service type to browse for.
 * @fires Browser#update
 */
var Browser = module.exports = function (serviceType) {
  if (!(this instanceof Browser)) { return new Browser(serviceType); }

  var notString = typeof serviceType !== 'string';
  var notType = !(serviceType instanceof ServiceType);
  if (notString && notType) {
    debug('serviceType type:', typeof serviceType);
    debug('serviceType is ServiceType:', serviceType instanceof ServiceType);
    debug('serviceType=', serviceType);
    throw new Error('argument must be instance of ServiceType or valid string');
  }
  this.serviceType = serviceType;
  var self = this;
  this._all = new EventEmitter();
  var services = {};
  var addresses = {};
  var connections = [];
  var created = 0;
  process.nextTick(function () {
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
          createSocket(index++, key,
            iface.address, 0, bindToAddress.bind(self));
        }
      }
    }

    createSocket(index++, 'pseudo multicast',
      '0.0.0.0', 5353, bindToAddress.bind(self));
  }.bind(this));


  function createSocket(interfaceIndex, networkInterface, address, port, cb) {
    var sock = dgram.createSocket('udp4');
    debug('creating socket for interface %s', address);
    created++;
    sock.bind(port, address, function (err) {
      if (port === 5353 && address === '0.0.0.0') {
        sock.addMembership(MDNS_MULTICAST);
      }
      cb(err, interfaceIndex, networkInterface, sock);
    });
  }



  function bindToAddress (err, interfaceIndex, networkInterface, sock) {
    if (err) {
      debug('there was an error binding %s', err);
      return;
    }
    debug('bindToAddress');
    var info = sock.address();

    var connection = {
      socket:sock,
      hasTraffic: false,
      interfaceIndex: interfaceIndex,
      networkInterface: networkInterface,
      services: services,
      addresses: addresses
    };

    connections.push(connection);

    sock.on('message', function () {
      connection.hasTraffic = true;
      [].push.call(arguments, connection);
      internal.onMessage.apply(this, arguments);
    }.bind(this));

    sock.on('error', _onError);
    sock.on('close', function () {
      debug('socket closed', info);
    });

    self._all.on('broadcast', function () {
      internal.broadcast(sock, serviceType);
    }.bind(this));

    if (created === connections.length) {
      this.emit('ready', connections.length);
    }
  }//--bindToAddress


  function _onError (err) {
    debug('socket error', err);
    self.emit('error', err);
  }


  this.stop = function () {
    debug('stopping');
    debug('connection.services', services);
    debug('connection.addresses', addresses);
    for (var i = 0; i < connections.length; i++) {
      var socket = connections[i].socket;
      socket.close();
      socket.unref();
    }
    connections = [];
  };//--start



  /**
   * Close interfaces where no traffic have occured
   */
  this.closeUnused = function () {
    var i;
    debug('closing sockets without traffic');
    var closed = [];
    for (i = 0; i < connections.length; i++) {
      var connection = connections[i];
      if (!connection.hasTraffic) {
        connection.socket.close();
        connection.socket.unref();
        closed.push(connection);
      }
    }
    for (i = 0; i < closed.length; i++) {
      var index = connections.indexOf(closed[i]);
      connections.splice(index, 1);
    }
    closed = [];
  };//--closeUnused
};//--Browser constructor

util.inherits(Browser, EventEmitter);

// /**
//  * Handles socket listen event
//  * @private
//  */
// Browser.prototype._onListening = function () {
//     var address = this.sock.address();
//     debug('Browser listening on %s:%s', address.address, address.port);
// };



Browser.prototype.discover = function () {
  process.nextTick(function () {
    debug('emitting broadcast request');
    this._all.emit('broadcast');
  }.bind(this));
};

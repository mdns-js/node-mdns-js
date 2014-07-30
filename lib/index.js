var debug = require('debug')('mdns:mdns');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram = require('dgram');
var os = require('os');

var DNSPacket = require('./dnspacket');
var DNSRecord = require('./dnsrecord');

var CONSTANTS = require('./constants');

var ServiceType = require('./service_type').ServiceType;

var internal = {};


internal.createSocket = function (address, callback) {
    var sock = dgram.createSocket('udp4');
    debug('creating socket for interface %s', address);

    sock.bind(0, address, function (err) {
        callback(err, sock);
    });
};

var Mdns = module.exports = function (serviceType) {
    if(!(this instanceof Mdns)) return new Mdns(serviceType);
    this.serviceType = serviceType;
    this._all = new EventEmitter();

    var connections = [];
    var created = 0;
    process.nextTick(function () {
        var interfaces = os.networkInterfaces();
        for(var key in interfaces) {
            if(interfaces.hasOwnProperty(key)) {
                for(var i = 0; i < interfaces[key].length; i++) {
                    var address = interfaces[key][i].address;
                    //no IPv6 addresses
                    if (address.indexOf(':') != -1) {
                        continue;
                    }
                    createSocket(address, bindToAddress.bind(this));
                }
            }
        }
        
    }.bind(this));


    function createSocket(address, callback) {
        var sock = dgram.createSocket('udp4');
        debug('creating socket for interface %s', address);
        created++;
        sock.bind(0, address, function (err) {
            callback(err, sock);
        });
    }


    function bindToAddress (err, sock) {
        if(err) {
            debug('there was an error binding %s', err);
            return;
        }
        debug('bindToAddress');
        var info = sock.address();
        var connection = {socket:sock, hasTraffic: false};
        connections.push(connection);
        //sock.on('listening', this._onListening.bind(this));
        sock.on('message', function(){
          [].push.call(arguments,connection);
          this._onMessage.apply(this,arguments);
        }.bind(this));
        sock.on('message', function () {
            connection.hasTraffic = true;
        });
        sock.on('error', this._onError.bind(this));
        sock.on('close', function () {
            debug('socket closed', info);
        });

        //this._broadcast(sock);
        this._all.on('broadcast', function () {
            this._broadcast(sock);
        }.bind(this));

        if(created == connections.length) {
            this.emit('ready', connections.length);
        }
    }

    this.shutdown = function () {
        debug('shutting down');
        for(var i=0; i < connections.length; i++) {
            var socket = connections[i].socket;
            socket.close();
            socket.unref();
        }
        connections = [];
    };

    this.closeUnused = function () {
        debug('closing sockets without traffic');
        var closed = [];
        for(var i=0; i < connections.length; i++) {
            var connection = connections[i];
            if (!connection.hasTraffic) {
                connection.socket.close();
                connection.socket.unref();
                closed.push(connection);
            }
        }
        for(var i=0; i<closed.length; i++) {
            var index = connections.indexOf(closed[i]);
            connections.splice(index, 1);
        }
        closed = [];
    };
};//--Mdns constructor

util.inherits(Mdns, EventEmitter);



Mdns.prototype._broadcast = function(sock) {
    debug('broadcasting to', sock.address());
    var packet = new DNSPacket();
    // packet.push('qd', new DNSRecord('_services._dns-sd._udp.local', 12, 1));
    packet.push('qd', new DNSRecord(this.serviceType.toString() + ".local", CONSTANTS.TYPES.PTR, 1));
    var buf = packet.toBuffer();
    debug('created buffer with length', buf.length);
    sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
        debug('%s sent %d bytes with err:%s', sock.address().address, bytes, err);
    });
};

Mdns.prototype._onError = function(err) {
    debug('socket error', err);
    this.emit('error', err);
};


// /**
//  * Handles socket listen event
//  * @private
//  */
// Mdns.prototype._onListening = function () {
//     var address = this.sock.address();
//     debug('Mdns listening on %s:%s', address.address, address.port);
// };


/**
 * Handles incoming UDP traffic.
 * @private
 */
Mdns.prototype._onMessage = function (message, remote, connection) {

  debug('got packet from remote', remote);
  var packet = DNSPacket.parse(message);

  var data = {};
  data.remote = remote;
  packet.each('qd', CONSTANTS.TYPES.PTR, function (rec) {
    data.query = rec.name;
  }.bind(this));

  packet.each('an', CONSTANTS.TYPES.PTR, function (rec) {
    var name = rec.asName();
    try {
      var type = new ServiceType(name);
      data.type = {
        name: type.name,
        protocol: type.protocol,
        subtypes: type.subtypes
      };
    } catch (e) {
      data.name = name;
    }
  }.bind(this));

  packet.each('ar', CONSTANTS.TYPES.SRV, function(rec) {
    var srv = rec.asSrv();
    data.port = srv.port;
    data.host = srv.target + ".local";
  });

  packet.each('ar', CONSTANTS.TYPES.TXT, function(rec) {
    data.txt = rec.asTxt();
  });

  data.addresses = [];
  data.addresses.push(remote.address)

  packet.each('ar', CONSTANTS.TYPES.A, function(rec) {
    if(data.addresses.indexOf(rec.asA())<0)
      data.addresses.push(rec.asA());
  });
  Mdns._sortIps(data.addresses);

  this.emit('update', data);
};

/**
 * Sorts the passed list of string IPs in-place.
 * @private
 */
Mdns._sortIps = function(arg) {
  arg.sort(Mdns._sortIps.sort);
  return arg;
};
Mdns._sortIps.sort = function(l, r) {
  // TODO: support v6.
  var lp = l.split('.').map(Mdns._sortIps._toInt);
  var rp = r.split('.').map(Mdns._sortIps._toInt);
  for (var i = 0; i < Math.min(lp.length, rp.length); ++i) {
    if (lp[i] < rp[i]) {
      return -1;
    } else if (lp[i] > rp[i]) {
      return +1;
    }
  }
  return 0;
};
Mdns._sortIps._toInt = function(i) { 
    return +i; 
};


Mdns.prototype.discover = function () {
    process.nextTick(function () {
        debug('emitting broadcast request');
        this._all.emit('broadcast');
    }.bind(this));    
};

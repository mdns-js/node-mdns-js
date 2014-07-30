var debug = require('debug')('mdns:mdns');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram = require('dgram');
var os = require('os');

var DNSPacket = require('./dnspacket');
var DNSRecord = require('./dnsrecord');
var sorter = require('./sorter');

var ServiceType = require('./service_type').ServiceType;

var internal = {};


internal.broadcast = function(sock, serviceType) {
    debug('broadcasting to', sock.address());
    var packet = new DNSPacket();
    
    packet.push('qd', new DNSRecord(serviceType.toString() + '.local', DNSRecord.Type.PTR, 1));
    var buf = packet.toBuffer();
    debug('created buffer with length', buf.length);
    sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
        debug('%s sent %d bytes with err:%s', sock.address().address, bytes, err);
    });
};

/**
 * Handles incoming UDP traffic.
 * @private
 */
internal.onMessage = function (message, remote) {

  debug('got packet from remote', remote);
  var packet = DNSPacket.parse(message);

  var data = {};
  data.remote = remote;
  packet.each('qd', DNSRecord.Type.PTR, function (rec) {
    data.query = rec.name;
  }.bind(this));

  packet.each('an', DNSRecord.Type.PTR, function (rec) {
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

  packet.each('ar', DNSRecord.Type.SRV, function(rec) {
    var srv = rec.asSrv();
    data.port = srv.port;
    data.host = srv.target + '.local';
  });

  packet.each('ar', DNSRecord.Type.TXT, function(rec) {
    data.txt = rec.asTxt();
  });

  data.addresses = [];
  packet.each('ar', DNSRecord.Type.A, function(rec) {
    data.addresses.push(rec.asA());
  });
  sorter.sortIps(data.addresses);

  this.emit('update', data);
};


var Mdns = module.exports = function (serviceType) {
    if(!(this instanceof Mdns)) return new Mdns(serviceType);
    var self = this;
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
                    createSocket(address, bindToAddress.bind(self));
                }
            }
        }   
    }.bind(this));

    function createSocket (address, callback) {
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

        sock.on('message', function(){
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

        if(created == connections.length) {
            this.emit('ready', connections.length);
        }
    }//--bindToAddress

    
    function _onError (err) {
        debug('socket error', err);
        self.emit('error', err);
    }

  

    this.shutdown = function () {
        debug('shutting down');
        for(var i=0; i < connections.length; i++) {
            var socket = connections[i].socket;
            socket.close();
            socket.unref();
        }
        connections = [];
    };//--shutdown



    this.closeUnused = function () {
        var i;
        debug('closing sockets without traffic');
        var closed = [];
        for(i=0; i < connections.length; i++) {
            var connection = connections[i];
            if (!connection.hasTraffic) {
                connection.socket.close();
                connection.socket.unref();
                closed.push(connection);
            }
        }
        for(i=0; i<closed.length; i++) {
            var index = connections.indexOf(closed[i]);
            connections.splice(index, 1);
        }
        closed = [];
    };//--closeUnused
};//--Mdns constructor

util.inherits(Mdns, EventEmitter);

// /**
//  * Handles socket listen event
//  * @private
//  */
// Mdns.prototype._onListening = function () {
//     var address = this.sock.address();
//     debug('Mdns listening on %s:%s', address.address, address.port);
// };



Mdns.prototype.discover = function () {
    process.nextTick(function () {
        debug('emitting broadcast request');
        this._all.emit('broadcast');
    }.bind(this));    
};



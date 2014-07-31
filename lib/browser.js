var debug = require('debug')('mdns:browser');
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
internal.onMessage = function (message, remote, connection) {
    debug('got packet from remote', remote);
    var packet = DNSPacket.parse(message);

    var data = {
        interfaceIndex: connection.interfaceIndex,
        networkInterface: connection.networkInterface,
        addresses: [remote.address]
    };

    packet.each('qd', DNSRecord.Type.PTR, function (rec) {
    data.query = rec.name;
    }.bind(this));

    ['an', 'ns', 'ar'].forEach(function(section) {
        packet.each(section, DNSRecord.Type.PTR, function (rec) {
            var name = rec.asName();
            if(!data.hasOwnProperty('type')) {
                data.type = [];
              }
            try {
              var type = new ServiceType(name);
              data.type.push({
                name: type.name,
                protocol: type.protocol,
                subtypes: type.subtypes
              });
            } catch (e) {
                debug('error', e);
              data.type.push({name: name});
            }
        });
        
        packet.each(section, DNSRecord.Type.SRV, function(rec) {
            var srv = rec.asSrv();
            data.port = srv.port;
            data.host = srv.target + '.local';
        });
        
        packet.each(section, DNSRecord.Type.TXT, function(rec) {
            data.txt = rec.asTxt();
        });

        packet.each(section, DNSRecord.Type.A, function(rec) {
            var value = rec.asA();
            if(data.addresses.indexOf(value) < 0) {
                data.addresses.push(value);
            }
        });
        sorter.sortIps(data.addresses);
        
        packet.each(section, DNSRecord.Type.AAAA, function(rec) {
            var value = rec.asAAAA();
            if(data.addresses.indexOf(value) < 0) {
                data.addresses.push(value);
            }
        });
        
    });//-forEach section

    this.emit('update', data);
};

/**
 * mDNS Browser class
 * @class
 * @param {string|ServiceType} serviceType - The service type to browse for.
 */
var Browser = module.exports = function (serviceType) {
    if(!(this instanceof Browser)) { return new Browser(serviceType); }
    if (typeof serviceType !== 'string' && !(serviceType instanceof ServiceType)) {
        debug('serviceType type:', typeof serviceType);
        debug('serviceType is ServiceType:', serviceType instanceof ServiceType);
        debug('serviceType=', serviceType);
        throw new Error('argument must be instance of ServiceType or valid string');
    }
    this.serviceType = serviceType;
    var self = this;
    this._all = new EventEmitter();
    
    var connections = [];
    var created = 0;
    process.nextTick(function () {
        var interfaces = os.networkInterfaces();
        var index = 0;
        for(var key in interfaces) {
            if(interfaces.hasOwnProperty(key)) {
                for(var i = 0; i < interfaces[key].length; i++) {
                    var address = interfaces[key][i].address;
                    debug('interface', key, interfaces[key]);
                    //no IPv6 addresses
                    if (address.indexOf(':') !== -1) {
                        continue;
                    }
                    createSocket(index++, key, address, bindToAddress.bind(self));
                }
            }
        }   
    }.bind(this));


    function createSocket (interfaceIndex, networkInterface, address, callback) {
        var sock = dgram.createSocket('udp4');
        debug('creating socket for interface %s', address);
        created++;
        sock.bind(0, address, function (err) {
            callback(err, interfaceIndex, networkInterface, sock);
        });
    }


    function bindToAddress (err, interfaceIndex, networkInterface, sock) {
        if(err) {
            debug('there was an error binding %s', err);
            return;
        }
        debug('bindToAddress');
        var info = sock.address();
        var connection = {socket:sock, hasTraffic: false,
            interfaceIndex: interfaceIndex,
            networkInterface: networkInterface};

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

        if(created === connections.length) {
            this.emit('ready', connections.length);
        }
    }//--bindToAddress

    
    function _onError (err) {
        debug('socket error', err);
        self.emit('error', err);
    }

  
    this.stop = function () {
        debug('stopping');
        for(var i=0; i < connections.length; i++) {
            var socket = connections[i].socket;
            socket.close();
            socket.unref();
        }
        connections = [];
    };//--start



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



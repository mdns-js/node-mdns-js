var debug = require('debug')('mdns:mdns');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram = require('dgram');
var os = require('os');

var DNSPacket = require('./dnspacket');
var DNSRecord = require('./dnsrecord');
var sorter = require('./sorter');

var UPDATE_INTERVAL=100;

var internal = {};

var Mdns = module.exports = function (opts) {
    if(!(this instanceof Mdns)) return new Mdns(opts);
    var self = this;
    var _byIP = {};
    var _byService = {};
    this._all = new EventEmitter();
    var _callback_pending = undefined; //used by _onMessage
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
        sock.on('message', _onMessage);
        sock.on('message', function () {
            connection.hasTraffic = true;
        });
        sock.on('error', _onError);
        sock.on('close', function () {
            debug('socket closed', info);
        });

        //this._broadcast(sock);
        self._all.on('broadcast', function () {
            _broadcast(sock);
        }.bind(this));

        if(created == connections.length) {
            this.emit('ready', connections.length);
        }
    }//--bindToAddress

    function _broadcast (sock) {
        debug('broadcasting to', sock.address());
        var packet = new DNSPacket();
        packet.push('qd', new DNSRecord('_services._dns-sd._udp.local', 12, 1));
        var buf = packet.toBuffer();
        debug('created buffer with length', buf.length);
        sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
            debug('%s sent %d bytes with err:%s', sock.address().address, bytes, err);
        });
    };


    function _onError (err) {
        debug('socket error', err);
        self.emit('error', err);
    };



    /**
     * Handles incoming UDP traffic.
     * @private
     */
    function _onMessage (message, remote) {
        var _getDefault = function(o, k, def) {
            (k in o) || false === (o[k] = def);
            return o[k];
        };

        debug('_onMessage - got packet from remote', remote);
        var packet = DNSPacket.parse(message);
        var byIP = _getDefault(_byIP, remote.address, {});
        
        packet.each('an', 12, function (rec) {
            var ptr = rec.asName();
            var byService = _getDefault(_byService, ptr, {});
            byService[remote.address] = true;
            byIP[ptr] = true;
        });

        debug('emitting packet');
        self.emit('packet', packet);

        //emit update if it has not been done within the last UPDATE_INTERVAL
        if (!_callback_pending) {
            _callback_pending = true;
            setTimeout(function () {
                debug('emitting update');
                _callback_pending = undefined;
                self.emit('update', self);            
            }, UPDATE_INTERVAL);
        }
    };//--_onMessage



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
    };//--closeUnused



    /**
     * Returns the IPs found by this, optionally filtered by service.
     */
    this.ips = function(opt_service) {
        debug('ips(%j)', opt_service);
        var x = typeof opt_service !== 'undefined' ? _byService[opt_service] : _byIP;
        if(typeof x === 'undefined') {
            return [];
        }
        else {    
            var k = Object.keys(x);
            return sorter.sortIps(k);
        }
    };//--ips

    /**
     * Returns the services found by this ServiceFinder, optionally filtered by IP.
     */
    this.services = function(opt_ip) {
      var k = Object.keys(opt_ip ? _byIP[opt_ip] : _byService);
      k.sort();
      return k;
    };//--services



    this.createAdvertisement = function (service, port) {
        throw new Error('Not implemented');
    }




};//--Mdns constructor

util.inherits(Mdns, EventEmitter);


Mdns.prototype.discover = function () {
    process.nextTick(function () {
        debug('emitting broadcast request');
        this._all.emit('broadcast');
    }.bind(this));    
};


Mdns.tcp = function (protocol) {
    //some kind of handler
    return function () {
        debug('handle tcp');
    }
}
var debug = require('debug')('zeroconfjs:lib:client');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var dgram = require('dgram');

var dns = require('./dns');

var UPDATE_INTERVAL=100;

var Client = module.exports = function (opts) {
    if(!(this instanceof Client)) return new Client(opts);
    this._byIP = {};
    this._byService = {};
    
    process.nextTick(function () {
        var sock = this.sock = dgram.createSocket('udp4');
        sock.bind();
        sock.on('listening', this._onListening.bind(this));
        sock.on('message', this._onMessage.bind(this));
    }.bind(this));
};

util.inherits(Client, EventEmitter);

Client.prototype._broadcast = function(sock) {
    debug('broadcasting');
    var packet = new dns.DNSPacket();
    packet.push('qd', new dns.DNSRecord('_services._dns-sd._udp.local', 12, 1));
    var buf = packet.toBuffer();
    debug('buf', buf.length);
    sock.send(buf, 0, buf.length, 5353, '224.0.0.251', function (err, bytes) {
        debug('send', err, bytes);
    });
};

Client.prototype._onListening = function () {
    var address = this.sock.address();
    debug('Client listening on %s:%s', address.address, address.port);
};


/**
 * Handles incoming UDP traffic.
 * @private
 */
Client.prototype._onMessage = function (message, remote) {
    var _getDefault = function(o, k, def) {
        (k in o) || false === (o[k] = def);
        return o[k];
      };
    debug('got packet from remote', remote);
    var packet = dns.DNSPacket.parse(message);
    var byIP = _getDefault(this._byIP, remote.address, {});
    
    packet.each('an', 12, function (rec) {
        var ptr = rec.asName();
        var byService = _getDefault(this._byService, ptr, {});
        byService[remote.address] = true;
        byIP[ptr] = true;
    }.bind(this));

    //emit update if it has not been done within the last UPDATE_INTERVAL
    if (!this._callback_pending) {
        this._callback_pending = true;
        setTimeout(function () {
            this._callback_pending = undefined;
            this.emit('update', this);            
        }.bind(this), UPDATE_INTERVAL);
    }
};


Client.prototype.discover = function () {
    process.nextTick(function () {
        this._broadcast(this.sock);
    }.bind(this));
};
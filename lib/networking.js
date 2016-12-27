var debug = require('debug')('mdns:lib:networking');
var debuginbound = require('debug')('mdns:inbound');
var debugoutbound = require('debug')('mdns:outbound');

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var os = require('os');
var dgram = require('dgram');
var semver = require('semver');

var dns = require('dns-js');
var DNSPacket = dns.DNSPacket;

var MDNS_MULTICAST_IPV4 = '224.0.0.251';
var MDNS_MULTICAST_IPV6 = 'FF02::FB';

var Networking = module.exports = function(options) {
    this.options = options || {};
    this.created = 0;
    this.connections = [];
    this.started = false;
    this.users = [];
    this.INADDR_ANY = typeof this.options.INADDR_ANY === 'undefined' ? true : this.options.INADDR_ANY;
    this.ADDR_FAMILY = typeof this.options.ADDR_FAMILY === 'undefined' ? 'IPv4' : this.options.ADDR_FAMILY;
};

util.inherits(Networking, EventEmitter);

Networking.prototype.start = function() {
    var interfaces = os.networkInterfaces();
    var ifaceFilter = this.options.networkInterface;
    var index = 0;
    for (var key in interfaces) {
        if ((interfaces.hasOwnProperty(key)) &&
            ((typeof ifaceFilter === 'undefined') || (key === ifaceFilter))) {
            for (var i = 0; i < interfaces[key].length; i++) {
                var iface = interfaces[key][i];
                //no localhost
                if (iface.internal) {
                    continue;
                }

                // Skip address family IPv4 when using IPv6
                if (this.ADDR_FAMILY === 'IPv6' && iface.family === 'IPv4') {
                    continue;
                }
                // Skip address family IPv6 when using IPv4
                if (this.ADDR_FAMILY === 'IPv4' && iface.family === 'IPv6') {
                    continue;
                }

                debug('interface', key, iface.address);
                this.createSocket(index++, key,
                    iface.address, 0, iface.family, this.bindToAddress.bind(this));
            }
        }
    }
    // apple-tv always replies back using multicast,
    // regardless of the source of the query, it is answering back
    if (this.INADDR_ANY) {
        this.createSocket(index++, 'IPv4 pseudo multicast', '0.0.0.0', 5353, 'IPv4', this.bindToAddress.bind(this));
        this.createSocket(index++, 'IPv6 pseudo multicast', '::', 5353, 'IPv6', this.bindToAddress.bind(this));
    }
};


Networking.prototype.stop = function() {
    debug('stopping');

    this.connections.forEach(closeEach);
    this.connections = [];

    function closeEach(connection) {
        var socket = connection.socket;
        socket.close();
        socket.unref();
    }
};


Networking.prototype.createSocket = function(
    interfaceIndex, networkInterface, address, port, family, next) {
    var sock;
    var type = 'udp' + family.slice(-1);
    if (semver.gte(process.versions.node, '0.11.13')) {
        sock = dgram.createSocket({ type: type, reuseAddr: true });
    }
    else {
        sock = dgram.createSocket(type);
    }
    sock.on('error', function(err) {
        next(err, interfaceIndex, networkInterface, sock);
    });
    debug('creating socket for', networkInterface);
    this.created++;


    sock.bind(port, address, function(err) {
        if ((!err) && (port === 5353)) {
            if (address.indexOf('.') !== -1) {
                sock.addMembership(MDNS_MULTICAST_IPV4);
            } else {
                sock.addMembership(MDNS_MULTICAST_IPV6);
            }
            sock.setMulticastTTL(255);
            sock.setMulticastLoopback(true);
        }
        next(err, interfaceIndex, networkInterface, sock);
    });

};


Networking.prototype.bindToAddress = function(err, interfaceIndex, networkInterface, sock) {
    if (err) {
        debug('there was an error binding %s', err);
        return;
    }
    debug('bindToAddress', networkInterface);
    var info = sock.address();

    var connection = {
        socket: sock,
        interfaceIndex: interfaceIndex,
        networkInterface: networkInterface,
        counters: {
            sent: 0,
            received: 0
        }
    };

    this.connections.push(connection);
    var self = this;

    sock.on('message', function(message, remote) {
        var packets;
        connection.counters.received++;
        debuginbound('incoming message', message.toString('hex'));
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

    sock.on('close', function() {
        debug('socket closed', info);
    });


    if (this.created === this.connections.length) {
        this.emit('ready', this.connections.length);
    }
};//--bindToAddress


Networking.prototype.onError = function(err) {
    this.emit('error', err);
};


Networking.prototype.send = function(packet) {
    var buf = DNSPacket.toBuffer(packet);
    this.connections.forEach(onEach);
    debug('created buffer with length', buf.length);
    debugoutbound('message', buf.toString('hex'));
    function onEach(connection) {
        var sock = connection.socket;
        // if the user did not specially asked for the pseudo interface
        // skip sending message on that interface.
        // TODO Pseudo interface implementation restricted to IPv4
        if ((sock.address().address === '0.0.0.0' && !this.INADDR_ANY) || this.ADDR_FAMILY === 'IPv6') {
            debug('skip send on pseudo interface.');
        }
        else {
            debug('sending to', sock.address());

            var family = sock.type === 'udp4' ? MDNS_MULTICAST_IPV4 : MDNS_MULTICAST_IPV6

            sock.send(buf, 0, buf.length, 5353, family, function(err, bytes) {
                connection.counters.sent++;
                debug('%s sent %d bytes with err:%s', sock.address().address, bytes,
                    err);
            });
        }
    }
};

Networking.prototype.startRequest = function(callback) {
    if (this.started) {
        return process.nextTick(callback());
    }
    this.start();
    this.once('ready', function() {
        if (typeof callback === 'function') {
            callback();
        }
    });
};


Networking.prototype.stopRequest = function() {
    if (this.users.length === 0) {
        this.stop();
    }
};


Networking.prototype.addUsage = function(browser, next) {
    this.users.push(browser);
    this.startRequest(next);
};


Networking.prototype.removeUsage = function(browser) {
    var index = this.users.indexOf(browser);
    if (index > -1) {
        this.users.splice(index, 1);
    }
    this.connections.forEach(function(c) {
        if (c.services && c.services[browser.serviceType.toString()])
            delete c.services[browser.serviceType.toString()];
    });
    this.stopRequest();
};

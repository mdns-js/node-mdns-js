const debug = require('debug')('mdns:test:mock_MockNetworking');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const dns = require('dns-js');
const DNSPacket = dns.DNSPacket;

const mockRemote = {address: '127.0.0.20', port: '1024'};
const mockConnection = {networkInterface: 'ethMock'};

const MockNetworking = module.exports = function (options) {
  this.options = options || {};
  this.created = 0;
  this.connections = [];
  this.started = false;
  this.users = [];
  this.interfaces = {'Ethernet': [{internal: false, address: '127.0.0.10' }]};
  this.INADDR_ANY = typeof this.options.INADDR_ANY === 'undefined' ?
    true : this.options.INADDR_ANY;
};

util.inherits(MockNetworking, EventEmitter);


MockNetworking.prototype.start = function () {
  debug('start');
  if (!this.started) {
    this.started = true;
    process.nextTick(() => {
      this.emit('ready');
    });
  }
};

MockNetworking.prototype.stop = function () {
  debug('stop');
  this.connections.forEach((connection) => {
    var socket = connection.socket;
    socket.close();
    socket.unref();
  });
  this.connections = [];
  this.created = 0;
  this.started = false;
};


MockNetworking.prototype.send = function (packet, callback) {
  debug('sending mock packet');
  var buf = DNSPacket.toBuffer(packet);
  this.emit('send', {packet: packet, buffer: buf});
  if (typeof callback === 'function') {
    callback(null, buf.length);
  }
};

MockNetworking.prototype.addUsage = function (browser, next) {
  debug('addUsage(%s, %s)', typeof browser, typeof next);
  this.users.push(browser);
  this.startRequest(next);
};

MockNetworking.prototype.startRequest = function (callback) {
  if (this.started) {
    debug('startRequest:started', typeof callback);
    return process.nextTick(callback);
  }
  this.start();
  this.once('ready', function () {
    debug('startRequest:ready');
    if (typeof callback === 'function') {
      callback();
    }
  });
};

MockNetworking.prototype.removeUsage = function (browser) {
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

MockNetworking.prototype.receive = function (packets) {
  debug('receive %s packets', packets.length);

  this.emit('packets', packets, mockRemote, mockConnection);
};

MockNetworking.prototype.stopRequest = function () {
  if (this.users.length === 0) {
    this.stop();
  }
};

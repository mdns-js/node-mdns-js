var debug = require('debug')('mdns:lib:dnsrecord');
var DataConsumer = require('./bufferconsumer');
var BufferWriter = require('./bufferwriter');

/**
 * DNSRecord is a record inside a DNS packet; e.g. a QUESTION, or an ANSWER,
 * AUTHORITY, or ADDITIONAL record. Note that QUESTION records are special,
 * and do not have ttl or data.
 * @class
 * @param {string} name
 * @param {number} type
 * @param {number} cl - class
 * @param {number} [optTTL] - time to live in seconds
 * @param {Buffer} [optData] - additional data ad Node.js Buffer.
 */
var DNSRecord = module.exports = function (name, type, cl, optTTL, optData) {
  this.name = name;
  this.type = type;
  this.cl = cl;

  this.isQD = (arguments.length === 3);
  if (!this.isQD) {
    this.ttl = optTTL;
    this.data_ = optData;
    debug('create non-QD record: %s, ttl: %d, data.len: %d',
      name, optTTL, optData.length);
  }
};

/**
 * Enum for record type values
 * @readonly
 * @enum {number}
 */
DNSRecord.Type = {
  A: 0x01,        // 1
  PTR: 0x0c,      // 12
  TXT: 0x10,      // 16
  AAAA: 0x16,     // 28
  SRV: 0x21,      // 33
  ANY: 0xff       // 255
};

/**
 * Enum for record class values
 * @readonly
 * @enum {number}
 */
DNSRecord.Class = {
  IN: 0x01,
  ANY: 0xff,
  FLUSH: 0x8000,
  IS_QM: 0x8000
};

DNSRecord.TTL = 60 * 60; // one hour default TTL


DNSRecord.toName = function (name) {
  var out = new BufferWriter();
  out.name(name);
  return out.buf.slice(0, out.offset);
};


DNSRecord.prototype.asName = function () {
  debug('parse PTR');

  // This addresses an issue with certain MDNS services (Airplay) that report
  // their service type through the FQDN name as apposed to the data field.
  if (typeof this.name === 'string') {
    var splitName = this.name.split('.');
    if (splitName.length === 3 && splitName[2] === 'local') {
      return splitName.slice(0, 2).join('.');
    }
  }

  return new DataConsumer(this.data_).name();
};


DNSRecord.toSrv = function (priority, weigth, port, target) {
  var out = new BufferWriter();
  out.short(priority).short(weigth).short(port).name(target);
  return out.buf.slice(0, out.offset);
};


DNSRecord.prototype.asSrv = function () {
  debug('parse SRV');
  var consumer = new DataConsumer(this.data_);
  return {
    priority: consumer.short(),
    weight: consumer.short(),
    port: consumer.short(),
    target: consumer.name()
  };
};


DNSRecord.toTxt = function (text) {
  var out = new BufferWriter();
  for (var key in text) {
    out.name(key + '=' + text[key]);
  }
  return out.buf.slice(0, out.offset);
};


DNSRecord.prototype.asTxt = function () {
  debug('parse TXT');
  var consumer = new DataConsumer(this.data_);
  var data = {};
  var items = consumer.name(false);
  items.forEach(function (item) {
    item = item.split('=');
    data[item[0]] = item[1];
  });
  return data;
};


DNSRecord.toA = function (ip) {
  var out = new BufferWriter();
  var parts = ip.split('.');
  for (var i = 0; i < 4; i++) {
    out.byte(parts[i]);
  }
  return out.buf.slice(0, out.offset);
};


DNSRecord.prototype.asA = function () {
  debug('parse A');
  var consumer = new DataConsumer(this.data_);
  var data = '';
  for (var i = 0; i < 3; i++) {
    data += consumer.byte() + '.';
  }
  data += consumer.byte();
  return data;
};


/*
 * Parse data into a IPV6 address string
 * @returns {string}
 */
DNSRecord.prototype.asAAAA = function () {
  debug('parse AAAA');
  var consumer = new DataConsumer(this.data_);
  var data = '';
  for (var i = 0; i < 7; i++) {
    data += consumer.short().toString(16) + ':';
  }
  data += consumer.short().toString(16);
  return data;
};


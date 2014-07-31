var DataConsumer = require('./bufferconsumer');
/**
 * DNSRecord is a record inside a DNS packet; e.g. a QUESTION, or an ANSWER,
 * AUTHORITY, or ADDITIONAL record. Note that QUESTION records are special,
 * and do not have ttl or data.
 * @class
 * @param {string} name
 * @param {number} type
 * @param {number} cl - class 
 * @param {number} [opt_ttl] - time to live in seconds
 * @param {Buffer} [opt_data] - additional data ad Node.js Buffer.
 */
var DNSRecord = module.exports = function(name, type, cl, opt_ttl, opt_data) {
  this.name = name;
  this.type = type;
  this.cl = cl;

  this.isQD = (arguments.length === 3);
  if (!this.isQD) {
    this.ttl = opt_ttl;
    this.data_ = opt_data;
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
    AAAA: 28,       // 0x16
    SRV: 0x21       // 33
};


DNSRecord.prototype.asName = function() {
  return new DataConsumer(this.data_).name();
};


DNSRecord.prototype.asSrv = function() {
	var consumer = new DataConsumer(this.data_);
	return {
		priority: consumer.short(),
		weight: consumer.short(),
		port: consumer.short(),
		target: consumer.name()
	};
};


DNSRecord.prototype.asTxt = function() {
	var consumer = new DataConsumer(this.data_);
	var data = {};
	var items = consumer.name(false);
	items.forEach(function(item) {
		item = item.split('=');
		data[item[0]] = item[1];
	});
	return data;
};


DNSRecord.prototype.asA = function() {
	var consumer = new DataConsumer(this.data_);
	var data = '';
	for(var i = 0; i < 3; i++) {
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
    var consumer = new DataConsumer(this.data_);
    var data = '';
    for(var i = 0; i < 7; i++) {
        data += consumer.short().toString(16) +':';
    }
    data += consumer.short().toString(16);
    return data;
};


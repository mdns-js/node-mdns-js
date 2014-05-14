var debug = require('debug')('mdns:lib:dns');
var BufferWriter = require('./bufferwriter');
var DataConsumer = require('./bufferconsumer');
var DNSRecord = require('./dnsrecord');

/**
 * DNSPacket holds the state of a DNS packet. It can be modified or serialized
 * in-place.
 *
 * @constructor
 */
var DNSPacket = module.exports = function(opt_flags) {
  this.flags_ = opt_flags || 0; /* uint16 */
  this.data_ = {'qd': [], 'an': [], 'ns': [], 'ar': []};
};

/**
 * Parse a DNSPacket from an Buffer
 */
DNSPacket.parse = function(buffer) {
  var consumer = new DataConsumer(buffer);
  if (consumer.short()) {
    throw new Error('DNS packet must start with 00 00');
  }

  var flags = consumer.short();
  var count = {
    'qd': consumer.short(),
    'an': consumer.short(),
    'ns': consumer.short(),
    'ar': consumer.short(),
  };
  debug('parsing flags: 0x%s, count: %j', flags.toString('16'), count);

  var packet = new DNSPacket(flags);

  // Parse the QUESTION section.
  for (var i = 0; i < count.qd; ++i) {
    var part = new DNSRecord(
        consumer.name(),
        consumer.short(),  // type
        consumer.short()); // class
    packet.push('qd', part);
  }

  // Parse the ANSWER, AUTHORITY and ADDITIONAL sections.
  ['an', 'ns', 'ar'].forEach(function(section) {
    for (var i = 0; i < count[section]; ++i) {
      
      var part = new DNSRecord(
          consumer.name(),
          consumer.short(), // type
          consumer.short(), // class
          consumer.long(),  // ttl
          consumer.slice(consumer.short()));
      packet.push(section, part);
    }
  });

  consumer.isEOF() || console.warn('was not EOF on incoming packet');
  return packet;
};

DNSPacket.prototype.push = function(section, record) {
  this.data_[section].push(record);
};

DNSPacket.prototype.each = function(section) {
  var filter = false;
  var call;
  if (arguments.length == 2) {
    call = arguments[1];
  } else {
    filter = arguments[1];
    call = arguments[2];
  }
  this.data_[section].forEach(function(rec) {
    if (!filter || rec.type == filter) {
      call(rec);
    }
  });
};


/**
 * Serialize this DNSPacket into an Buffer for sending over UDP.
 */
DNSPacket.prototype.toBuffer = function() {
  var out = new BufferWriter();
  var s = ['qd', 'an', 'ns', 'ar'];
  out.short(0)
  .short(this.flags_);

  s.forEach(function (section) {
    out.short(this.data_[section].length);
  }.bind(this));

  s.forEach(function (section) {
    this.data_[section].forEach(function (rec) {
      out.name(rec.name).short(rec.type).short(rec.cl);

      if (section != 'qd') {
        throw new Error('can\'t yet serialize non-QD records');
      }
    });
  }.bind(this));

  return out.buf.slice(0, out.offset);
};


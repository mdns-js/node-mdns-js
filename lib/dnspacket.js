var debug = require('debug')('mdns:lib:dnspacket');
var BufferWriter = require('./bufferwriter');
var DataConsumer = require('./bufferconsumer');
var DNSRecord = require('./dnsrecord');

/**
 * DNSPacket holds the state of a DNS packet. It can be modified or serialized
 * in-place.
 *
 * @constructor
 */
var DNSPacket = module.exports = function (flags) {
  this.flags_ = flags || 0; /* uint16 */
  this.data_ = {'qd': [], 'an': [], 'ns': [], 'ar': []};

  debug('Response',
    (flags & DNSPacket.Flag.RESPONSE) === DNSPacket.Flag.RESPONSE);
  debug('Authorative',
    (flags & DNSPacket.Flag.AUTHORATIVE) === DNSPacket.Flag.AUTHORATIVE);
  debug('Truncated',
    (flags & DNSPacket.Flag.TRUNCATED) === DNSPacket.Flag.TRUNCATED);
  debug('Recursion',
    (flags & DNSPacket.Flag.RECURSION) === DNSPacket.Flag.RECURSION);

};

/**
 * Enum identifying DNSPacket flags
 * @readonly
 * @enum {number}
 */
DNSPacket.Flag = {
  RESPONSE: 0x8000,
  AUTHORATIVE: 0x400,
  TRUNCATED: 0x200,
  RECURSION: 0x100,
};


/**
 * Enum identifying DNSPacket sections
 * @readonly
 * @enum {string}
 */
DNSPacket.Section = {
  QUESTION: 'qd',
  ANSWER: 'an',
  AUTHORITY: 'ns',
  ADDITIONAL: 'ar'
};



/**
 * Parse a DNSPacket from an Buffer
 * @param {Buffer} buffer - A Node.js Buffer instance
 * @returns {DNSPacket} Instance of DNSPacket
 */
DNSPacket.parse = function (buffer) {
  var consumer = new DataConsumer(buffer);
  if (consumer.short()) { //transaction id
    throw new Error('DNS packet must start with 00 00');
  }

  var flags = consumer.short();
  var count = {
    'qd': consumer.short(), //Question Count
    'an': consumer.short(), //Answer Record Count
    'ns': consumer.short(), //Authority Record Count
    'ar': consumer.short(), //Additional record count
  };
  debug('parsing flags: 0x%s, count: %j', flags.toString('16'), count);

  var packet = new DNSPacket(flags);

  // Parse the QUESTION section.
  for (var i = 0; i < count.qd; ++i) {
    var part = new DNSRecord(
        consumer.name(),
        consumer.short(),  // type
        consumer.short()); // class
    packet.push(DNSPacket.Section.QUESTION, part);
    debug('new qd dnsrecord: %j', part);
  }

  // Parse the ANSWER, AUTHORITY and ADDITIONAL sections.
  ['an', 'ns', 'ar'].forEach(function (section) {
    for (var i = 0; i < count[section]; ++i) {
      var part = new DNSRecord(
          consumer.name(),
          consumer.short(), // type
          consumer.short(), // class
          consumer.long(),  // ttl
          consumer.slice(consumer.short()));
      packet.push(section, part);
      debug('new %s dnsrecord: %j', section, part);
    }
  });

  debug('qd: %d/%d, an: %d/%d', count.qd, packet.data_.qd.length,
    count.an, packet.data_.an.length);

  consumer.isEOF() || debug('was not EOF on incoming packet');
  return packet;
};

DNSPacket.prototype.push = function (section, record) {
  this.data_[section].push(record);
};

/**
 * Get records from packet
 * @param {DNSPacket.Section} section - record section [qd|an|ns|ar],
 * @param {DNSRecord.Type} [filter] - DNSRecord.Type to filter on
 * @param {DNSPacket~eachCallback} callback - Function callback
 */
DNSPacket.prototype.each = function (section /*[filter] callback*/) {
  var filter = false;
  var cb;
  if (arguments.length === 2) {
    cb = arguments[1];
  } else {
    filter = arguments[1];
    cb = arguments[2];
  }
  this.data_[section].forEach(function (rec) {
    if (!filter || rec.type === filter) {
      cb(rec);
    }
  });
};


/**
 * Serialize this DNSPacket into an Buffer for sending over UDP.
 * @returns {Buffer} A Node.js Buffer
 */
DNSPacket.prototype.toBuffer = function () {
  var out = new BufferWriter();
  var s = ['qd', 'an', 'ns', 'ar'];
  out.short(0)
  .short(this.flags_);

  s.forEach(function (section) {
    out.short(this.data_[section].length);
  }.bind(this));

  s.forEach(function (section) {
    debug('filling section: %s', section);
    this.data_[section].forEach(function (rec) {
      debug('filling record: %s', rec.name);
      out.name(rec.name).short(rec.type).short(rec.cl);

      if (rec.isQD && section !== 'qd') {
        throw new Error('unexpected QD record in non QD section.');
      }
      if (section !== 'qd') {
        out.long(rec.ttl).buffer(rec.data_);
      }
    });
  }.bind(this));

  return out.buf.slice(0, out.offset);
};


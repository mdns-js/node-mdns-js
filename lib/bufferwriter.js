var BufferWriter = module.exports = function (opt_size) {
  this.buf = new Buffer(opt_size || 512);
  this.offset = 0;
};

BufferWriter.prototype.short = function (v) {
  this.buf.writeUInt16BE(v, this.offset);
  this.offset += 2;
  return this;
};

BufferWriter.prototype.byte = function (v) {
  this.buf.writeUInt8(v, this.offset);
  this.offset += 1;
  return this;
};

/**
 * Writes a DNS name. If opt_ref is specified, will finish this name with a
 * suffix reference (i.e., 0xc0 <ref>). If not, then will terminate with a NULL
 * byte.
 */
BufferWriter.prototype.name = function(v, opt_ref) {
  var parts = v.split('.');
  parts.forEach(function(part) {
    this.byte(part.length);
    for (var i = 0; i < part.length; ++i) {
      this.byte(part.charCodeAt(i));
    }
  }.bind(this));
  if (opt_ref) {
    this.byte(0xc0).byte(opt_ref);
  } else {
    this.byte(0);
  }
  return this;
};
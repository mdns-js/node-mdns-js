var debug = require('debug')('mdns:lib:bufferconsumer');
var BufferConsumer = module.exports = function (arg) {
    if(! (arg instanceof Buffer) ) {
        throw new Error('Expected instance of Buffer');
    }
    this._view = arg;

    this._offset = 0;
};

BufferConsumer.prototype.slice = function (length) {
    if ((this._offset + length) > this._view.length) {
        debug('slice beyond buffer.', {offset:this._offset, length:length, 'buffer_length': this._view.length});
        throw new Error('Buffer overflow');
    }
    var v = this._view.slice(this._offset, this._offset + length);
    this._offset += length;
    return v;
};

BufferConsumer.prototype.isEOF = function () {
    return this._offset >= this._view.length;
};

BufferConsumer.prototype.byte = function () {
    this._offset += 1;
    return this._view.readUInt8(this._offset - 1);
};

BufferConsumer.prototype.short = function () {
    this._offset += 2;
    return this._view.readUInt16BE(this._offset - 2);
};

BufferConsumer.prototype.long = function() {
    this._offset += 4;
    return this._view.readUInt32BE(this._offset - 4);
};


/**
 * Consumes a DNS name, which will either finish with a NULL byte or a suffix
 * reference (i.e., 0xc0 <ref>).
 */
BufferConsumer.prototype.name = function(join) {
  if (typeof join === "undefined") join = true;
  var parts = [];
  this.ref = undefined;
  for (;;) {
    try {
      var len = this.byte();
    } catch (e) {
      if (e instanceof RangeError) break;
    }
    if (!len) {
      break;
    } else if (len == 0xc0) {
      // TODO: This indicates a pointer to another valid name inside the
      // DNSPacket, and is always a suffix: we're at the end of the name.
      // We should probably hold onto this value instead of discarding it.
      this.ref = this.byte();
      break;
    }

    // Otherwise, consume a string!
    var v = '';
    while (len-- > 0) {
      v += String.fromCharCode(this.byte());
    }
    parts.push(v);
  }
  if (join) {
    return parts.join('.');
  } else {
    return parts;
  }
};



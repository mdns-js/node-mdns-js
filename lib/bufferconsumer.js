var debug = require('debug')('mdns:lib:bufferconsumer');
var BufferConsumer = module.exports = function BufferConsumer(arg) {
  if (!(arg instanceof Buffer)) {
    throw new Error('Expected instance of Buffer');
  }
  this._view = arg;

  this._offset = 0;
};

BufferConsumer.prototype.slice = function slice(length) {
  if ((this._offset + length) > this._view.length) {
    debug('slice beyond buffer.', {
      offset:this._offset,
      length:length,
      bufferLength: this._view.length
    });
    throw new Error('Buffer overflow');
  }
  var v = this._view.slice(this._offset, this._offset + length);
  this._offset += length;
  return v;
};

BufferConsumer.prototype.isEOF = function isEOF() {
  return this._offset >= this._view.length;
};

BufferConsumer.prototype.byte = function byte() {
  this._offset += 1;
  return this._view.readUInt8(this._offset - 1);
};

BufferConsumer.prototype.short = function short() {
  this._offset += 2;
  return this._view.readUInt16BE(this._offset - 2);
};

BufferConsumer.prototype.long = function long() {
  this._offset += 4;
  return this._view.readUInt32BE(this._offset - 4);
};


/**
 * Consumes a DNS name, which will either finish with a NULL byte or a suffix
 * reference (i.e., 0xc0 <ref>).
 */
BufferConsumer.prototype.name = function name(join) {
  if (typeof join === 'undefined') { join = true; }
  var parts = [];
  var len;
  var savedOffset;
  for (;;) {
    try {
      len = this.byte();
    } catch (e) {
      if (e instanceof RangeError) { break; }
    }
    if (!len) {
      break;
    } else if (len >= 0xc0) {
      debug('compressed label: bits=%d', ((len & 0xc0) >> 6));
      // This indicates a pointer to another valid name inside the DNSPacket,
      // and is always a suffix: we're at the end of the name.
      // Store the current parse position and read the name from the offset.
      var offset = this.byte();
      offset |= ((len & ~0xc0) << 8);
      if (offset > this._view.length) {
        debug('!! offset=%d beyond buffer-size=%d', offset, this._view.length);
        break;
      }
      if (typeof savedOffset === 'undefined') {
        savedOffset = this._offset;
        debug('saved offset=%d', savedOffset);
      }
      this._offset = offset;
      debug('continue at %d', offset);
      continue;
    }
    if ((this._offset + len) > this._view.length) {
      debug('!! offset + len=%d+%d=%d beyond  buffer-size=%d', this._offset,
        len, (this._offset + len), this._view.length);
      break;
    }
    debug('reading string with len=%d at %d, remaining size=%d', len,
      this._offset, (this._view.length - this._offset));

    // Otherwise, consume a string!
    var v = '';
    while (len-- > 0) {
      v += String.fromCharCode(this.byte());
    }
    debug('single \'%s\', remaining size=%d', v,
      (this._view.length - this._offset));
    parts.push(v);
  }
  if (typeof savedOffset !== 'undefined') {
    this._offset = savedOffset;
    savedOffset = undefined;
  }
  debug('all labels \'%s\'', parts.join('.'));
  if (join) {
    return parts.join('.');
  } else {
    return parts;
  }
};



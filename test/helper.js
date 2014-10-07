var debug = require('debug')('mdns:test:helper');
var fs = require('fs');
var vm = require('vm');
var util = require('util');


exports.createJs = function (obj) {
  return util.inspect(obj, {depth: null});
};

exports.writeBin = function (filename, buf) {
  var ws = fs.createWriteStream(filename);
  ws.write(buf);
  ws.end();
};

exports.writeJs = function (filename, obj) {
  fs.writeFileSync(filename, exports.createJs(obj));
};


exports.readBin = function (filename) {
  return fs.readFileSync(filename);
};

exports.prepareJs = function (text) {
  //replace <Buffer aa bb> with new Buffer("aabb", "hex")
  var matches = text.match(/(<Buffer[ a-f0-9]*>)/g);
  if (matches) {
    debug('matches', matches);
    matches.forEach(function (m) {
      var bytes = m.match(/ ([a-f0-9]{2})/g);
      var str = bytes.join('');
      str = str.replace(/ /g, '');
      var r = 'new Buffer("' + str + '", "hex")';
      text = text.replace(m, r);
    });
  }
  return text;
};

exports.readJs = function (filename) {
  var js = 'foo = ' + fs.readFileSync(filename, 'utf8');
  js = exports.prepareJs(js);
  return vm.runInThisContext(js, filename);
};

exports.equalJs = function (expected, actual) {
  var e = exports.createJs(expected);
  var a = exports.createJs(actual);
  a.should.equal(e, 'Objects are not the same');
};

var equalDeep = exports.equalDeep = function (expected, actual, path) {

  var np = path || 'root';
  function dp (a, b) {
    return a + '.' + b;
  }

  for (var key in expected) {
    if (expected.hasOwnProperty(key)) {
      debug('expected %s', key, expected[key]);
      actual.should.have.property(key);
      var a = actual[key];
      var e = expected[key];
      if (e instanceof Buffer) {
        a.length.should.equal(e.length, 'not matching length of ' +
            dp(np, key));
        a.toString('hex').should.equal(e.toString('hex'),
          'buffer not same in ' + dp(np, key));
      }
      else if (typeof e === 'object') {
        equalDeep(e, a, dp(np, key));
      }
      else {
        if (key !== 'name') {
          var atype = typeof a;
          if (atype === 'undefined') {
            atype.should.equal(typeof e);
          }
          else {
            a.should.equal(e, util.format('%s (%s) is not as expected',
              dp(np, key), atype));
          }
        }
        else {
          a.should.have.length(e.length,
            util.format('wrong length of %s', dp(np, key)));
          debug('actual: %s, expected: %s', a, e);
        }
      }
    }
  }
};

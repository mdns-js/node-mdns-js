const debug = require('debug')('mdns:test:helper');
const fs = require('fs');
const vm = require('vm');
const util = require('util');
const path = require('path');
const { expect } = require('code');

const Mdns = require('../lib');
const Networking = require('../lib/networking');
const MockNetwork = require('./mock_networking');

exports.FIXTUREFOLDER = path.join(__dirname, 'fixtures');

exports.createMdns = function (mockNet) {
  var options;
  // if MOCKNETWORK is anything else but 'false' it will be used
  if (process.env.MOCKNETWORK !== 'false' || mockNet) {
    if (typeof mockNet === 'undefined') {
      mockNet = new MockNetwork();
    }
    options = {networking: mockNet};
  }
  else {
    options = {networking: new Networking()};
  }

  return new Mdns(options);
};

exports.createMockNetwork = function () {
  return new MockNetwork();
};

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
  if (arguments.length > 1) {
    filename = path.join(...arguments);
  }
  return fs.readFileSync(filename);
};

exports.prepareJs = function (text) {
  //replace <Buffer aa bb> with new Buffer("aabb", "hex")
  var matches = text.match(/(<Buffer[ a-f0-9]*>)/g);
  if (matches) {
    debug('matches', matches);
    matches.forEach(function (m) {
      var bytes = m.match(/ ([a-f0-9]{2})/g);
      var str = '';
      if (bytes !== null) {
        str = bytes.join('');
        str = str.replace(/ /g, '');
      }
      var r = 'new Buffer("' + str + '", "hex")';
      text = text.replace(m, r);
    });
  }
  //[Getter]
  text = text.replace(/\[Getter\]/g, 'undefined');
  return text;
};

exports.readJs = function (filename) {
  if (!fs.existsSync(filename)) {
    return false;
  }
  var js = exports.prepareJs('foo = ' + fs.readFileSync(filename, 'utf8'));
  var sandbox = {
    Buffer: Buffer
  };
  return vm.runInNewContext(js, sandbox, filename);
};


exports.equalJs = function (expected, actual) {
  var e = exports.createJs(expected);
  var a = exports.createJs(actual);
  expect(a, 'Objects are not the same').to.equal(e);
};

var equalDeep = exports.equalDeep = function (expected, actual, path) {

  var np = path || 'root';
  function dp(a, b) {
    return a + '.' + b;
  }

  for (var key in expected) {
    if (expected.hasOwnProperty(key)) {
      debug('looking at %s in %s', key, path);
      if (actual instanceof Array) {
        expect(key).to.be.most(actual.length - 1);
        //expect(actual[key], dp(np, key)).to.exist();
      }
      else {
        debug('actual', actual);
        expect(actual, path).to.include(key);
      }
      var a = actual[key];
      var e = expected[key];
      var prop = Object.getOwnPropertyDescriptor(actual, key);
      if (e instanceof Buffer) {
        expect(a, 'not matching length of ' + dp(np, key))
          .to.have.length(e.length);

        expect(a.toString('hex'), 'buffer not same in ' + dp(np, key))
          .to.equal(e.toString('hex'));
      }
      else if (typeof e === 'object') {
        equalDeep(e, a, dp(np, key));
      }
      else {
        if (key !== 'name') {
          var atype = typeof a;
          if (atype === 'undefined') {
            expect(atype).to.equal(typeof e);
          }
          else {
            //don't test getters
            if (!prop.get) {
              expect(a, util.format('%s (%s) is not as expected',
                dp(np, key), atype)).to.equal(e);
            }
          }
        }
        else {
          expect(a, util.format('wrong length of %s', dp(np, key)))
            .to.have.length(e.length);
          debug('actual: %s, expected: %s', a, e);
        }
      }
    }
  }
};

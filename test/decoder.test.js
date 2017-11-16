const Lab = require('lab');
const { describe,  it } = exports.lab = Lab.script();
const { expect } = require('code');


var debug = require('debug')('mdns:test:decoder');

var decoder = require('../lib/decoder');
var dns = require('dns-js');
var DNSPacket = dns.DNSPacket;
var path = require('path');
var fs = require('fs');

//var Schemas = require('./schemas');

var fixtureFolder = path.join(__dirname, 'fixtures');

var helper = require('./helper');


function testDecodeMessage(binFolder, jsFolder) {
  var files = fs.readdirSync(binFolder).filter(function (f) {
    return /\.bin$/.test(f);
  });

  files.forEach(function (file) {
    it('decode ' + file, () => {
      var djsFile = path.join(jsFolder,  file.replace('.bin', '.js'));
      var binFile = path.join(binFolder, file);

      var b = helper.readBin(binFile);
      var obj = decoder.decodeMessage(b);

      if (!fs.existsSync(djsFile)) {
        helper.writeJs(djsFile, obj);
      }
      else {
        var dj = helper.readJs(djsFile);
        helper.equalDeep(dj, obj);
      }


    });//--decode...
  });
}

describe('decoder', function () {
  describe('decodeSection', function () {
    it('should thow error on bad section', () => {
      var p = new DNSPacket();
      var obj = {};
      var throws = function () {
        decoder.decodeSection(p, 'asdfasdf', obj);
      };

      expect(throws).to.throw(Error);

    });

    it('should thow error on missing obj', () => {
      var p = new DNSPacket();
      var throws = function () {
        decoder.decodeSection(p, 'question');
      };

      expect(throws).to.throw(Error);

    });
  });

  // describe('decodeMessage', function () {
  //   testDecodeMessage(fixturesPacket, fixturesFolderMessages);
  // });

  describe('decodeMessage - fixture', function () {
    testDecodeMessage(fixtureFolder, fixtureFolder);
  });

  it('should decode', () => {
    var ret;
    var b = helper.readBin(path.join(
      __dirname,
      'fixtures',
      'mdns-readynas.bin'
    ));
    var packet = DNSPacket.parse(b);
    debug('packet', helper.createJs(packet));
    var obj = {};
    ret = decoder.decodeSection(packet, 'question', obj);
    expect(ret).to.be.equal(false);

    ret = decoder.decodeSection(packet, 'answer', obj);
    expect(ret).to.be.ok;
    expect(obj).to.include('type');
    expect(obj.type).to.have.length(13);
    obj.type.forEach(function (t) {
      expect(t).to.be.a.object(); //('object');
      expect(t).to.include(['name', 'protocol', 'subtypes']);
      expect(t.protocol).to.equal('tcp');

      //expect(t.subtypes).to.equal([]);
      expect(t.name.length).to.be.above(2);
    });
    debug('ret: %s, obj', ret, obj);

  });
});



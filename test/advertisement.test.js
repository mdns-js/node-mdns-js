/*global describe: true, it: true */
//var debug = require('debug')('mdns:test');
var should = require('should');
var pf = require('../lib/packetfactory');
var mdns = require('../');
var dns = require('mdns-js-packet');
var DNSPacket = dns.DNSPacket;
var DNSRecord = dns.DNSRecord;

function mockAdvertisement() {
  var context = {};
  context.options = {
    name: 'hello',
  };
  context.nameSuffix = '';
  context.port = 4242;
  context.serviceType = mdns.tcp('_http');
  return context;
}

describe('packetfactory', function () {

  it('buildQDPacket', function (done) {
    var context = mockAdvertisement();
    var packet = pf.buildQDPacket.apply(context, []);
    context.alias.should.equal('hello._http._tcp.local');
    should.exist(packet);
    done();
  });


  it('buildANPacket', function (done) {
    var context = mockAdvertisement();
    var packet = pf.buildQDPacket.apply(context, []);
    pf.buildANPacket.apply(context, [DNSRecord.TTL]);
    should.exist(packet);
    done();
  });


  it('createAdvertisement', function () {
    var service = mdns.createAdvertisement(mdns.tcp('_http'), 9876,
    {
      name:'hello',
      txt:{
        txtvers:'1'
      }
    });

    service.should.have.property('port', 9876);
    service.should.have.property('options');
    service.options.should.have.property('name', 'hello');
  });
});

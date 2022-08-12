const Lab = require('@hapi/lab');
const {describe,  it } = exports.lab = Lab.script();
const { expect } = require('@hapi/code');


var pf = require('../lib/packetfactory');
var mdns = require('../');
var dns = require('dns-js');
// var DNSPacket = dns.DNSPacket;
var DNSRecord = dns.DNSRecord;

function mockAdvertisement() {
  var context = {};
  context.options = {
    name: 'hello'
  };
  context.nameSuffix = '';
  context.port = 4242;
  context.serviceType = mdns.tcp('_http');
  return context;
}

describe('packetfactory', function () {

  it('buildQDPacket', () => {
    var context = mockAdvertisement();
    var packet = pf.buildQDPacket.apply(context, []);
    expect(context.alias).to.equal('hello._http._tcp.local');
    expect(packet).to.exist();

  });


  it('buildANPacket', () => {
    var context = mockAdvertisement();
    var packet = pf.buildQDPacket.apply(context, []);
    pf.buildANPacket.apply(context, [DNSRecord.TTL]);
    expect(packet).to.exist();

  });


  it('createAdvertisement', () => {
    var service = mdns.createAdvertisement(mdns.tcp('_http'), 9876, {
      name:'hello',
      txt:{
        txtvers:'1'
      }
    });

    expect(service).to.include({port:9876});
    expect(service.serviceType).to.include({name: 'http', protocol: 'tcp'});
    expect(service).to.include('options');
    expect(service.options, 'options').to.include({name: 'hello'});

  });
});

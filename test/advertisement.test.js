var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
//var before = lab.before;
//var after = lab.after;
var Code = require('code');   // assertion library
var expect = Code.expect;


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

  it('buildQDPacket', function (done) {
    var context = mockAdvertisement();
    var packet = pf.buildQDPacket.apply(context, []);
    expect(context.alias).to.equal('hello._http._tcp.local');
    expect(packet).to.exist();
    done();
  });


  it('buildANPacket', function (done) {
    var context = mockAdvertisement();
    var packet = pf.buildQDPacket.apply(context, []);
    pf.buildANPacket.apply(context, [DNSRecord.TTL]);
    expect(packet).to.exist();
    done();
  });


  it('createAdvertisement', function (done) {
    var service = mdns.createAdvertisement(mdns.tcp('_http'), 9876, {
      name: 'hello',
      txt: {
        txtvers: '1'
      }
    });

    expect(service).to.include({ port: 9876 });
    expect(service.serviceType).to.include({ name: 'http', protocol: 'tcp' });
    expect(service).to.include('options');
    expect(service.options, 'options').to.include({ name: 'hello' });

    done();

  });

  it('should enable setting networking options', function (done) {
    var service = mdns.createAdvertisement(mdns.tcp('_http'), 9876, {
      name: 'hello',
      txt: {
        txtvers: '1'
      }
    });

    expect(mdns.getNetworkOptions()).to.be.empty();
    mdns.setNetworkOptions({ test: 'test' });
    expect(mdns.getNetworkOptions()).to.include('test');
    mdns.setNetworkOptions({});
    expect(mdns.getNetworkOptions()).to.be.empty();

    done();
  });

  it('should enable restricting to linkLocal only addresses', function (done) {
    var service = mdns.createAdvertisement(mdns.tcp('_http'), 9876, {
      name: 'hello',
      txt: {
        txtvers: '1'
      }
    });

    expect(mdns.networking.INADDR_ANY).to.equal(true);
    mdns.listenOnLinkLocalMulticastOnly();
    expect(mdns.networking.INADDR_ANY).to.equal(false);

    done();
  });

  it('should work be able to set address family', function (done) {
    var service = mdns.createAdvertisement(mdns.tcp('_http'), 9876, {
      name: 'hello',
      txt: {
        txtvers: '1'
      }
    });

    expect(mdns.networking.ADDR_FAMILY).to.equal('IPv4');
    mdns.setAddressFamily('IPv6');
    expect(mdns.networking.ADDR_FAMILY).to.equal('IPv6');
    mdns.setAddressFamily('both');
    expect(mdns.networking.ADDR_FAMILY).to.equal('both');
    mdns.setAddressFamily('any');
    expect(mdns.networking.ADDR_FAMILY).to.equal('any');

    done();
  });

});

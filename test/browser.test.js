const Lab = require('lab');
const {describe,  it } = exports.lab = Lab.script();
const { expect } = require('code');
const { createMdns, createMockNetwork, readBin, FIXTUREFOLDER } = require('./helper');

var mockNetworking = createMockNetwork();
const {ServiceType} = require('../lib/service_type');

const packets = require('./packets.json');
const { DNSPacket } = require('dns-js');

mockNetworking.on('send', () => {
  var p = DNSPacket.parse(new Buffer.from(packets.responses.services.linux_workstation, 'hex'));
  mockNetworking.receive([p]);
});

describe('browser', () => {
  it('should create default browser', () => {
    var mdns = createMdns(mockNetworking);
    var b1 = mdns.createBrowser();

    return new Promise((resolve) => {
      b1.on('ready', () => {
        b1.discover();
      });

      b1.on('update', (data) => {
        expect(data).to.include({addresses: ['127.0.0.20']});
        expect(data).to.include({query: [ '_services._dns-sd._udp.local' ]});
        resolve();
      });
    });
  });

  it('should create browser with servicetype', () => {
    var mdns = createMdns(mockNetworking);
    var b1 = mdns.createBrowser(ServiceType.wildcard);
    expect(b1).to.exist();
  });

  it('should not create browser without good type', () => {
    var mdns = createMdns(mockNetworking);
    expect(() => {
      mdns.createBrowser({});
    }).to.throw(Error, 'argument must be instance of ServiceType or valid string');
  });

  it('should emit error on funky packet', () => {
    const net = createMockNetwork();
    net.on('send', () => {
      var p = DNSPacket.parse(new Buffer.from(packets.responses.services.funky1, 'hex'));
      net.receive([p]);
    });
    var mdns = createMdns(net);
    var b1 = mdns.createBrowser();
    return new Promise((resolve) => {
      b1.on('ready', () => {
        b1.discover();
      });

      b1.on('update', (data) => {
        expect(data).to.include({addresses: ['127.0.0.20']});
        expect(data).to.include({query: [ '_services._dns-sd._udp.local' ]});
        resolve();
      });
    });
  });

  it('should emit error on issue76 packet', () => {
    const net = createMockNetwork();
    net.on('send', () => {
      var p = DNSPacket.parse(readBin(FIXTUREFOLDER, 'mdns-issue76.bin'));
      net.receive([p]);
    });
    var mdns = createMdns(net);
    var b1 = mdns.createBrowser();

    return new Promise((resolve) => {
      b1.on('ready', () => {
        b1.discover();
      });

      b1.on('error', (err) => {
        expect(err.name).to.equal('ServiceTypeDecodeError');
        return resolve();
      });
    });
  });
});

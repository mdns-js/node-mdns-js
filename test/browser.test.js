const Lab = require('lab');
const {describe,  it } = exports.lab = Lab.script();
const { expect } = require('code');

const Mdns = require('../lib');
const MockNetworking = require('./mock_networking');
var mockNetworking = new MockNetworking();
const {ServiceType} = require('../lib/service_type');

const packets = require('./packets.json');
const { DNSPacket } = require('dns-js');

mockNetworking.on('send', () => {
  var p = DNSPacket.parse(new Buffer.from(packets.responses.services.linux_workstation, 'hex'));
  mockNetworking.receive([p]);
});

describe('browser', () => {
  it('should create default browser', () => {
    var mdns = new Mdns({networking: mockNetworking});
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
    var mdns = new Mdns({networking: mockNetworking});
    var b1 = mdns.createBrowser(ServiceType.wildcard);
    expect(b1).to.exist();
  });

  it('should not create browser without good type', () => {
    var mdns = new Mdns({networking: mockNetworking});
    expect(() => {
      mdns.createBrowser({});
    }).to.throw(Error, 'argument must be instance of ServiceType or valid string');
  });
});

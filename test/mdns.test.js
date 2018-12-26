const Lab = require('lab');
const { after, before, describe,  it } = exports.lab = Lab.script();
const { expect } = require('code');
const { createMdns } = require('./helper');
const { DNSPacket } = require('dns-js');
const packets = require('./packets.json');

const mdns = createMdns();

if (mdns.networking.mock){
  const net = mdns.networking;
  net.on('send', () => {

    var p = DNSPacket.parse(new Buffer.from(packets.responses.services.linux_workstation, 'hex'));
    net.receive([p]);

  });
}

// var Code = require('code');   // assertion library
// var expect = Code.expect;

describe('mDNS', function () {
  var browser;
  before(function () {
    mdns.excludeInterface('0.0.0.0');
    expect(mdns,  'library does not exist!?').to.exist(mdns);

    return new Promise((resolve) => {
      browser = mdns.createBrowser();

      browser.on('ready', function onReady() {
        resolve();
      });
    });
  });

  after(function () {
    browser.stop();
  });


  // it('should .discover()', {skip: process.env.MDNS_NO_RESPONSE}, () => {
  it('should .discover()', () => {
    setTimeout(browser.discover.bind(browser), 500);

    return new Promise((resolve) => {
      browser.once('update', function onUpdate(data) {
        expect(data).to.include(['interfaceIndex', 'networkInterface',
          'addresses', 'query']);
        resolve();
      });
    });
  });


  it('should close all connection socket on stop', {timeout: 15000}, () => {
    let service = mdns.createAdvertisement(mdns.tcp('_http'), 9876, {
      name: 'hello',
      txt: {
        txtvers: '1'
      }
    });
    let waitClose = [...service.networking.connections].map(connection => new Promise(resolve => {
      connection.socket.addListener('close', resolve);
    }));

    service.start();

    return new Promise((resolve) => {
      setTimeout(() => {
        service.stop(resolve);
      }, 1000);
    }
    ).then(() => Promise.all(waitClose)
    );
  });
});

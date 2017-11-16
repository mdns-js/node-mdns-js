
const Lab = require('lab');
const { after, before, describe,  it } = exports.lab = Lab.script();
const { expect } = require('code');


// var Code = require('code');   // assertion library
// var expect = Code.expect;
var mdns = require('../');



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


  it('should .discover()', {skip: process.env.MDNS_NO_RESPONSE}, () => {
    browser.once('update', function onUpdate(data) {
      expect(data).to.include(['interfaceIndex', 'networkInterface',
        'addresses', 'query']);

    });

    setTimeout(browser.discover.bind(browser), 500);
  });

});

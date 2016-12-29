var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var Code = require('code');   // assertion library
var expect = Code.expect;
var mdns = require('../');

var browser;
function setup(listenTo) {
  return function (done) {
    mdns.setListenTo(listenTo);
    expect(mdns,  'library does not exist!?').to.exist(mdns);
    browser = mdns.createBrowser();

    browser.on('ready', function onReady() {
      done();
    });
  };
}


describe('mDNS', function () {

  describe('IPv4', function () {
    before(setup('0.0.0.0'));

    after(function (done) {
      browser.stop();
      done();
    });

    it('should .discover()', {skip: process.env.MDNS_NO_RESPONSE},
      function (done) {
        browser.once('update', function onUpdate(data) {
          expect(data).to.include(['interfaceIndex', 'networkInterface',
            'addresses', 'query']);
          done();
        });

        setTimeout(browser.discover.bind(browser), 500);
      });
  });

  describe('IPv6', function () {
    before(setup('::'));

    after(function (done) {
      browser.stop();
      done();
    });

    it('should .discover()', {skip: process.env.MDNS_NO_RESPONSE},
      function (done) {
        browser.once('update', function onUpdate(data) {
          expect(data).to.include(['interfaceIndex', 'networkInterface',
            'addresses', 'query']);
          done();
        });

        setTimeout(browser.discover.bind(browser), 500);
      });
  });

});

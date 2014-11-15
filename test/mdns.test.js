/*global describe: true, it: true, before: true, after: true */
//var debug = require('debug')('mdns:test');
var should = require('should');
var mdns = require('../');



describe('mDNS', function () {
  var browser;
  before(function (done) {
    should.exist(mdns, 'library does not exist!?');
    browser = mdns.createBrowser();

    browser.on('ready', function onReady(socketcount) {
      socketcount.should.be.above(0);
      done();
    });
  });

  after(function () {
    browser.stop();
  });


  it('should .discover()', function (done) {
    browser.once('update', function onUpdate(data) {
      //mdns._byService.should.have.property('_workstation._tcp');
      data.should.have.property('interfaceIndex');
      data.should.have.property('networkInterface');
      data.should.have.property('addresses');
      data.should.have.property('query');
      if (data.query !== '_services._dns-sd._udp.local')
      data.should.have.property('type');
      done();
    });
    setTimeout(browser.discover.bind(browser), 500);
  });


  it('should close unused', function (done) {
    browser.closeUnused();
    setTimeout(done, 500);
  });
});

/*global describe: true, it: true, before: true, after: true */

var should = require('should');
var Mdns = require('../');



describe('mDNS', function () {
    var mdns;
    before(function (done) {
        should.exist(Mdns);
        mdns = Mdns();
        mdns.should.be.instanceof(Mdns);
        mdns.on('ready', function (socketcount) {
            socketcount.should.be.above(0);
            done();
        });
    });

    after(function () {
        mdns.shutdown();
    });

    it('should automatically create new Mdns', function () {
        
    });

    it('shoud .discover()', function (done) {   
        mdns.once('update', function () {
            mdns._byService.should.have.property('_workstation._tcp');
            console.log('services', mdns._byService);
            done();
        });
        setTimeout(mdns.discover.bind(mdns),500);
    });
});
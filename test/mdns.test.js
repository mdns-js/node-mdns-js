/*global describe: true, it: true, before: true, after: true */
//var debug = require('debug')('mdns:test');
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


    it('should .discover()', function (done) {   
        mdns.once('update', function () {
            //mdns._byService.should.have.property('_workstation._tcp');
            
            var hosts = mdns.ips('_workstation._tcp');
            hosts.should.be.instanceof(Array);
            hosts.length.should.be.above(0);

            var services = mdns.services();
            services.should.be.instanceof(Array);
            services.length.should.be.above(0);
            done();
        });
        setTimeout(mdns.discover.bind(mdns),500);
    });

    
    it('should not crash on missing service when listing ips', function (done) {
        var missing = mdns.ips('this service should not exist');
        missing.should.be.instanceof(Array);
        missing.length.should.equal(0);
        done();
    });    


    it('should not crash on missing host when listing services', function (done) {
        var missing = mdns.services('this ip should not exist');
        missing.should.be.instanceof(Array);
        missing.length.should.equal(0);
        done();
    });

    it('should close unused', function (done) {
        mdns.closeUnused();
        setTimeout(done, 500);
    });

    describe.skip('advertisements', function () {
        it('createAdvertisement', function (done) {
            var ad = mdns.createAdvertisement(Mdns.tcp('http'), 4242);
            should.exist(ad);
            done();
        });
    });
    
});
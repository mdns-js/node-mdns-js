

var should = require('should');
var Client = require('../lib/client');



describe('Client', function () {
    
    it('should exist', function () {
        should.exist(Client);
    });

    it('should be able to create new', function () {
        var client = new Client();
        client.should.be.instanceof(Client);
    });

    it('should automatically create new Client', function () {
        var client = Client();
        client.should.be.instanceof(Client);
    });

    it('shoud .discover()', function (done) {   
        var client = new Client();
        client.discover();
        client.once('update', function () {
            client._byService.should.have.property('_workstation._tcp');
            console.log('services', client._byService);
            done();
        });
    });

});
/*global describe: true, it: true */
var ServiceType = require('../lib/service_type').ServiceType;

describe('ServiceType', function () {
  it('should parse _http._tcp', function (done) {
    var type = new ServiceType('_http._tcp');
    type.protocol.should.equal('tcp');
    type.name.should.equal('http');
    type.subtypes.should.be.empty;
    done();
  });

  it('should parse service._http._tcp', function (done) {
    var type = new ServiceType('service._http._tcp');
    type.protocol.should.equal('tcp');
    type.name.should.equal('http');
    type.subtypes.should.be.empty;
    done();
  });

  it('should parse service._http._tcp.local', function (done) {
    var type = new ServiceType('service._http._tcp.local');
    type.protocol.should.equal('tcp');
    type.name.should.equal('http');
    type.subtypes.should.be.empty;
    done();
  });

  it('should parse _services._dns-sd._udp', function (done) {
    var type = new ServiceType('_services._dns-sd._udp');
    type.protocol.should.equal('udp');
    type.name.should.equal('services._dns-sd');
    type.subtypes.should.be.empty;
    done();
  });
});

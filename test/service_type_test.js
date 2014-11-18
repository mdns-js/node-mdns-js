var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
// var before = lab.before;
// var after = lab.after;
var Code = require('code');   // assertion library
var expect = Code.expect;

var ServiceType = require('../lib/service_type').ServiceType;

describe('ServiceType', function () {
  it('should parse _http._tcp', function (done) {
    var type = new ServiceType('_http._tcp');
    expect(type).to.include({protocol: 'tcp', name: 'http'});
    expect(type.subtypes).to.be.empty();
    done();
  });

  it('should parse service._http._tcp', function (done) {
    var type = new ServiceType('service._http._tcp');
    expect(type).to.include({protocol: 'tcp', name: 'http'});
    expect(type.subtypes).to.be.empty();
    done();
  });

  it('should parse service._http._tcp.local', function (done) {
    var type = new ServiceType('service._http._tcp.local');
    expect(type).to.include({protocol: 'tcp', name: 'http'});
    expect(type.subtypes).to.be.empty();
    done();
  });

  it('should parse _services._dns-sd._udp', function (done) {
    var type = new ServiceType('_services._dns-sd._udp');
    expect(type).to.include({protocol: 'udp', name: 'services._dns-sd'});
    expect(type.subtypes).to.be.empty();
    done();
  });
});

const Lab = require('lab');
const { describe,  it } = exports.lab = Lab.script();
const { expect } = require('code');


const ServiceType = require('../lib/service_type').ServiceType;

describe('ServiceType', () => {
  it('should parse _http._tcp', ()=> {
    var type = new ServiceType('_http._tcp');
    expect(1).to.equal(1);
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.be.empty();
    expect(type.isWildcard()).to.be.false();
    var a = type.toArray();
    expect(a).to.be.instanceof(Array);

  });

  it('should parse service._http._tcp', () => {
    var type = new ServiceType('service._http._tcp');
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.be.empty();

  });

  it('should parse service._http._tcp.local', () => {
    var type = new ServiceType('service._http._tcp.local');
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.be.empty();

  });

  it('should parse _services._dns-sd._udp', () => {
    var type = new ServiceType('_services._dns-sd._udp');
    expect(type).to.include({ protocol: 'udp', name: 'services._dns-sd' });
    expect(type.subtypes).to.be.empty();

  });

  it('should parse _companion-link._tcp.1082314964.members.btmm.icloud.com', () => {
    var type = new ServiceType('_companion-link._tcp.1082314964.members.btmm.icloud.com');
    expect(type).to.include({ protocol: 'tcp', name: 'companion-link',
      parentdomain: '1082314964.members.btmm.icloud.com' });
    expect(type.subtypes).to.be.empty();
  });

  it('should tak array as input', () => {
    var type = new ServiceType(['_http', '_tcp']);
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.be.empty();

  });

  it('should take multiple arguments is input', () => {
    var type = new ServiceType('_http', '_tcp');
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.be.empty();

  });

  it('should on empty arguments', () => {
    var type = new ServiceType();
    expect(type).to.include({ protocol: '', name: '' });
    expect(type.subtypes).to.be.empty();

  });

  it('should take object as argument', () => {
    var type = new ServiceType({ protocol: 'tcp', name: 'http' });
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.be.empty();

  });

  it('should take object with subtypes as argument', () => {
    var type = new ServiceType({
      protocol: 'tcp',
      name: 'http',
      subtypes: ['printer']
    });
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.equal(['printer']);

  });


  it('should subtype using _printer._sub', () => {
    var st = new ServiceType('_printer._sub._http._tcp.local');
    expect(JSON.stringify(st)).to.equal('{"name":"http","protocol":"tcp",' +
      '"subtypes":["_printer"],"parentdomain":"local"}');
    expect(st.toString()).to.equal('_http._tcp,_printer');

  });

  it('should subtype using ,_printer', () => {
    var st = new ServiceType('_http._tcp,_printer');
    expect(JSON.stringify(st)).to.equal('{"name":"http","protocol":"tcp",' +
      '"subtypes":["_printer"]}');

    expect(st.toString(), 'toString').to.equal('_http._tcp,_printer');

  });


  it('should default to _tcp', () => {
    var type = new ServiceType(['_http']);
    expect(type).to.include({ protocol: 'tcp', name: 'http' });
    expect(type.subtypes).to.be.empty();

  });


  it('should throw on bad protocol', () => {
    function fn() {
      new ServiceType('service._http._qwe.local');
    }
    expect(fn).to.throw(Error,
      'protocol must be either "_tcp" or "_udp" but is "_qwe"');

  });

  it('should throw on bad protocol', () => {
    var throws = function () {
      new ServiceType('service._http._qwe.local');
    };
    expect(throws).to.throw(Error,
      'protocol must be either "_tcp" or "_udp" but is "_qwe"');

  });

  it('should throw on missing object name', () => {
    function fn() {
      new ServiceType({ protocol: 'tcp' });
    }
    expect(fn).to.throw(Error,
      'required property name is missing');

  });

  it('should throw on missing object protocol', () => {
    function fn() {
      new ServiceType({ name: 'http' });
    }
    expect(fn).to.throw(Error,
      'required property protocol is missing');

  });

  it('should throw on number as input', () => {
    expect(fn).to.throw(Error, 'argument must be a string, array or object');

    function fn() {
      new ServiceType(1234);
    }
  });

  it('should work out _sub of apple-mobdev', () => {
    var s = new ServiceType('46c20544._sub._apple-mobdev2._tcp.local');
    expect(s.name, 'name').to.equal('apple-mobdev2');
    expect(s.subtypes).to.have.length(1);
    expect(s.subtypes[0], 'subtypes[0]').to.equal('46c20544');

  });

  it('should handle empty _sub of apple-mobdev', () => {
    //relates to issue #66
    var s = new ServiceType('_sub._apple-mobdev2._tcp.local');
    expect(s.name, 'name').to.equal('apple-mobdev2');
    expect(s.subtypes).to.have.length(1);
    expect(s.subtypes[0], 'subtypes[0]').to.equal('');

  });
});

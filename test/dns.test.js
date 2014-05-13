
var should = require('should');
var dns = require('../lib/dns');

var packets = require('./packets.json');



describe('DNSPacket', function () {
    it.skip('.toBuffer should give same bytes as .serialize', function (done) {
        var packet = new dns.DNSPacket();
        packet.push('qd', new dns.DNSRecord('_services._dns-sd._udp.local', 12, 1));
        var raw = packet.serialize();
        var buf = packet.toBuffer();

        raw.byteLength.should.equal(buf.length);
        for (var i = 0; i<raw.byteLength; i++) {
            buf[i].should.equal(raw[i], 'Missmatch in byte ' + i.toString());
        }
        buf.toString('hex').should.equal(packets.queries.services);
        done();
    });

    it('.parse', function () {
        var buf = new Buffer(packets.responses.linux_workstation, 'hex');
        var packet = dns.DNSPacket.parse(buf);
        packet.each('an', 12, function (rec) {
            should.exist(rec); //really no risk but jshint complains about unused should;
            var ptr = rec.asName();
            ptr.should.be.instanceof(String);
        }.bind(this));
    });
});
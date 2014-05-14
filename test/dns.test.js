
/*global describe: true, it: true */
var should = require('should');
var DNSPacket = require('../lib/dnspacket');
var DNSRecord = require('../lib/dnsrecord');

var packets = require('./packets.json');



describe('DNSPacket', function () {
    it('should convert packet to buffer with .toBuffer()', function (done) {
        var packet = new DNSPacket();
        packet.push('qd', new DNSRecord('_services._dns-sd._udp.local', 12, 1));        
        var buf = packet.toBuffer();
        buf.toString('hex').should.equal(packets.queries.services);
        done();
    });

    it('should read packet with .parse()', function () {
        var buf = new Buffer(packets.responses.linux_workstation, 'hex');
        var packet = DNSPacket.parse(buf);
        packet.each('an', 12, function (rec) {
            should.exist(rec); //really no risk but jshint complains about unused should;
            var ptr = rec.asName();
            ptr.should.be.instanceof(String);
        }.bind(this));
    });
});
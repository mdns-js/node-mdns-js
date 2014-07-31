
/*global describe: true, it: true */
var should = require('should');
var DNSPacket = require('../lib/dnspacket');
var DNSRecord = require('../lib/dnsrecord');

var packets = require('./packets.json');

should.exist(true);

describe('DNSPacket', function () {
    it('should convert packet to buffer with .toBuffer()', function (done) {
        var packet = new DNSPacket();
        packet.push('qd', new DNSRecord('_services._dns-sd._udp.local', DNSRecord.Type.PTR, 1));        
        var buf = packet.toBuffer();
        buf.toString('hex').should.equal(packets.queries.services);
        done();
    });

    it('should parse service response packet', function (done) {
        var buf = new Buffer(packets.responses.services.linux_workstation, 'hex');
        var packet = DNSPacket.parse(buf);
        var count = 0;
        packet.each('an', DNSRecord.Type.PTR, function (rec) {
            var ptr = rec.asName();
            ptr.should.be.instanceof(String);
            ['_workstation._tcp', '_udisks-ssh' ].should.containEql(ptr);
            count++;
        });
        count.should.equal(2);
        done();
    });

    it('should parse service response sample5', function (done) {
        var buf = new Buffer(packets.responses.services.sample5, 'hex');
        var packet = DNSPacket.parse(buf);

        var ptrCount=0;
        var aaaaCount=0;
        var srvCount=0;
        var txtCount=0;

        packet.each('an', DNSRecord.Type.PTR, function (rec) {
             rec.ttl.should.equal(10);
             var ptr = rec.asName();
             ['_workstation._tcp', '_nut', '_http', '_smb' ].should.containEql(ptr);
             //ptr.should.equal('_workstation._tcp')
             ptrCount++;
        });

        packet.each('an', DNSRecord.Type.AAAA, function (rec) {
            var aaaa = rec.asAAAA();
            aaaa.should.equal('fe80:0:0:0:2ac6:8eff:fe34:b8c3');
            aaaaCount++;
        });

        packet.each('an', DNSRecord.Type.SRV, function (rec) {
            var value = rec.asSrv();
            value.should.be.type('object');
            value.should.have.property('priority', 0),
            value.should.have.property('weight', 0),
            value.should.have.property('port', 9),
            value.should.have.property('target', 'vestri');
            srvCount++;
        });

        packet.each('an', DNSRecord.Type.TXT, function (rec) {
           var value = rec.asTxt();
           value.should.be.type('object');
           value.should.be.empty;

           txtCount++;
        });

        ptrCount.should.equal(4);
        aaaaCount.should.equal(0, 'bad AAAA count');
        txtCount.should.equal(0, 'bad TXT count');
        srvCount.should.equal(0, 'bad SRV count');
        done();
        
    });

    it('should parse a tcp workstation response', function (done) {
        var buf = new Buffer(packets.responses.tcp_workstation[1], 'hex');
        var packet = DNSPacket.parse(buf);

        var ptrCount=0;
        var aaaaCount=0;
        var srvCount=0;
        var txtCount=0;

        packet.each('an', DNSRecord.Type.PTR, function (rec) {
             rec.ttl.should.equal(10);
             var ptr = rec.asName();
             ptr.should.equal('vestri [28:c6:8e:34:b8:c3]');
             ptrCount++;
        });

        packet.each('an', DNSRecord.Type.AAAA, function (rec) {
            var aaaa = rec.asAAAA();
            aaaa.should.equal('fe80:0:0:0:2ac6:8eff:fe34:b8c3');
            aaaaCount++;
        });

        packet.each('an', DNSRecord.Type.SRV, function (rec) {
            var value = rec.asSrv();
            value.should.be.type('object');
            value.should.have.property('priority', 0),
            value.should.have.property('weight', 0),
            value.should.have.property('port', 9),
            value.should.have.property('target', 'vestri');
            srvCount++;
        });

        packet.each('an', DNSRecord.Type.TXT, function (rec) {
           var value = rec.asTxt();
           value.should.be.type('object');
           value.should.be.empty;

           txtCount++;
        });

        if (ptrCount===1 && aaaaCount === 1 && txtCount === 1 && srvCount === 1) {
            done();
        }
    });
});
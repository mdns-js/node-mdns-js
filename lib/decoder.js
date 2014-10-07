var debug = require('debug')('mdns:lib:decoder');
var DNSPacket = require('./dnspacket');
var DNSRecord = require('./dnsrecord');
var sorter = require('./sorter');
var ServiceType = require('./service_type').ServiceType;

module.exports.decodePacket = function (message) {
  debug('decodePacket');
  var packet = DNSPacket.parse(message);

  var data = {
    addresses: []
  };

  packet.each('qd', DNSRecord.Type.PTR, function (rec) {
    data.query = rec.name;
  }.bind(this));

  ['an', 'ns', 'ar'].forEach(function (section) {
    packet.each(section, DNSRecord.Type.PTR, function (rec) {
      var name = rec.asName();
      if (!data.hasOwnProperty('type')) {
        data.type = [];
      }
      try {
        var type = new ServiceType(name);
        data.type.push({
          name: type.name,
          protocol: type.protocol,
          subtypes: type.subtypes,
          description: type.getDescription()
        });
      } catch (e) {
        console.error('warning. cought an error generating ServiceType', e);
        debug('rec', rec);
        debug('packet: %s', message.toString('hex'));

        data.type.push({name: name});
      }
    });

    packet.each(section, DNSRecord.Type.SRV, function (rec) {
      var srv = rec.asSrv();
      data.port = srv.port;
      data.host = srv.target;
      if (data.host.indexOf('.local', data.host.length - 6) === -1) {
        data.host += '.local';
      }
    });

    packet.each(section, DNSRecord.Type.TXT, function (rec) {
      data.txt = rec.asTxt();
    });

    packet.each(section, DNSRecord.Type.A, function (rec) {
      var value = rec.asA();
      if (data.addresses.indexOf(value) < 0) {
        data.addresses.push(value);
      }
    });
    sorter.sortIps(data.addresses);

    packet.each(section, DNSRecord.Type.AAAA, function (rec) {
      var value = rec.asAAAA();
      if (data.addresses.indexOf(value) < 0) {
        data.addresses.push(value);
      }
    });
  });//-forEach section
  return data;
};



var should = require('should');
var servicefinder = require('../lib/servicefinder');



describe('servicefinder', function () {

    it('should exit', function () {
        should.exist(servicefinder);
    });
});
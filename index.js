var config = require('./package.json');
module.exports = require('./lib');
module.exports.version = config.version;
module.exports.name = config.name;


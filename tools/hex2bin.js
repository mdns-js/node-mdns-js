#!/usr/bin/env node
'use strict';

var fs = require('fs');

var inputFile = process.argv[2];

var input = fs.readFileSync(inputFile, 'utf8');

var output = new Buffer(input.toString(), 'hex');

process.stdout.write(output);

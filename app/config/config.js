'use strict';

//
// config.js
// Application configuration settings
//
// AIRR Knowledge API Service
// https://airr-knowledge.org
//
// Copyright (C) 2024 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

var path = require('path');
var fs = require('fs');
var yaml = require('js-yaml');

var config = {};

module.exports = config;

function parseBoolean(value)
{
    if (value == 'true') return true;
    else if (value == 1) return true;
    else return false;
}

// General
config.port = process.env.API_PORT;
config.name = 'AK-API';

// Host user for Corral access
config.hostServiceAccount = process.env.HOST_SERVICE_ACCOUNT;
config.hostServiceGroup = process.env.HOST_SERVICE_GROUP;

// Error/debug reporting
config.debug = parseBoolean(process.env.DEBUG_CONSOLE);

// standard info/error reporting
config.log = {};
config.log.info = function(context, msg, ignore_debug = false) {
    var date = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    if (ignore_debug)
        console.log(date, '-', config.name, 'INFO (' + context + '):', msg);
    else
        if (config.debug) console.log(date, '-', config.name, 'INFO (' + context + '):', msg);
}

config.log.error = function(context, msg) {
    var date = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    var full_msg = date + ' - ' + config.name + ' ERROR (' + context + '): ' + msg
    console.error(full_msg);
    console.trace(context);
    return full_msg;
}
config.log.info('config', 'Debug console messages enabled.', true);

// post error messages to a slack channel
config.slackURL = process.env.SLACK_WEBHOOK_URL;

// get service info
var infoFile = path.resolve(__dirname, '../../package.json');
var infoString = fs.readFileSync(infoFile, 'utf8');
var info = JSON.parse(infoString);
config.info = {};
config.info.title = info.name;
config.info.description = info.description;
config.info.version = info.version;
config.info.contact = {
    name: "AIRR Knowledge",
    url: "http://airr-knowledge.org/",
    email: "airr-knowledge@utsouthwestern.edu"
};
config.info.license = {};
config.info.license.name = info.license;

// get api info
var apiFile = fs.readFileSync(path.resolve(__dirname, '../swagger/ak-api.yaml'), 'utf8');
var apiSpec = yaml.safeLoad(apiFile);
config.info.api = apiSpec['info'];

// constraints
config.max_query_size = 2 * 1024 * 1024;
config.info.max_query_size = 2 * 1024 * 1024;


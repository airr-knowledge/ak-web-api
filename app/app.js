
'use strict';

//
// app.js
// Application entry
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

// Express Modules
var express      = require('express');
var errorHandler = require('errorhandler');
var bodyParser   = require('body-parser');
var openapi      = require('express-openapi');
var _            = require('underscore');
var path = require('path');
var fs = require('fs');
var yaml = require('js-yaml');
var $RefParser = require("@apidevtools/json-schema-ref-parser");


// Express app
var app = module.exports = express();
var context = 'app';

//var webhookIO = require('./vendor/webhookIO');
//var mongoSettings = require('./config/mongoSettings');

// Server Options
var config = require('./config/config');
app.set('port', config.port);
app.set('sslOptions', config.sslOptions);

// CORS
var allowCrossDomain = function(request, response, next) {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' === request.method) {
        response.status(200).end();
    }
    else {
        next();
    }
};

// Server Settings
// Allow cross-origin resource sharing
app.use(allowCrossDomain);

// redis config
app.redisConfig = {
    port: 6379,
    host: 'ak-redis'
};

// Tapis
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis(config);
var ServiceAccount = tapisIO.serviceAccount;
var GuestAccount = tapisIO.guestAccount;
var authController = tapisIO.authController;
var webhookIO = require('vdj-tapis-js/webhookIO');
var pgSettings = require('vdj-tapis-js/pgSettings');
pgSettings.set_config(config);
var pgIO = require('vdj-tapis-js/pgIO');


// Controllers
var apiResponseController = require('./controllers/apiResponseController');

// load API spec
var api_spec = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, './swagger/ak-api.yaml'), 'utf8'));

/*
// Downgrade to host vdj user
// This is also so that the /vdjZ Corral file volume can be accessed,
// as it is restricted to the TACC vdj account.
// Currently only read access is required.
if (config.hostServiceAccount) {
    config.log.info(context, 'Downgrading to host user: ' + config.hostServiceAccount);
    process.setgid(config.hostServiceGroup);
    process.setuid(config.hostServiceAccount);
    config.log.info(context, 'Current uid: ' + process.getuid());
    config.log.info(context, 'Current gid: ' + process.getgid());
} else {
    config.log.info('WARNING', 'config.hostServiceAccount is not defined, Corral access will generate errors.');
} */


// Verify we can login to Tapis
var ServiceAccount = tapisIO.serviceAccount;
ServiceAccount.getToken()
    .then(function() {
	config.log.info(context, 'Acquired Tapis service account token', true);
	return pgIO.testConnection();
    })
    .then(function() {
        config.log.info(context, 'Successfully connected to database.', true);

        // wait for the AIRR spec to be dereferenced
        //return airr.load_schema();
    })
    .then(function() {
        //config.log.info(context, 'Loaded AK Schema version ' + airr.get_info()['version']);

        // Drop in the AK schema
        //api_spec['components']['schemas'] = vdj_schema.get_schemas();

        // Connect schema to vdj-tapis
        //if (tapisIO == tapisV3) tapisV3.init_with_schema(vdj_schema);

        // dereference the API spec
        return $RefParser.dereference(api_spec);
    })
    .then(function(api_schema) {
	config.log.info(context, 'Loaded AK WEB API version: ' + api_spec.info.version, true);
        //console.log(JSON.stringify(api_schema,null,2));

        // wrap the operations functions to catch syntax errors and such
        // we do not get a good stack trace with the middleware error handler
        var try_function = async function (request, response, the_function) {
            try {
                await the_function(request, response);
            } catch (e) {
                console.error(e);
                console.error(e.stack);
                throw e;
            }
        };

        // Initialize express-openapi middleware
        openapi.initialize({
            apiDoc: api_schema,
            app: app,
            promiseMode: true,
            consumesMiddleware: {
                'application/json': bodyParser.json(),
                'application/x-www-form-urlencoded': bodyParser.urlencoded({extended: true})
            },
            errorMiddleware: function(err, req, res, next) {
                console.log('Got an error!');
                console.log(JSON.stringify(err));
                console.error(err.stack);
                if (err.status) res.status(err.status).json(err.errors);
                else apiResponseController.sendError('Unknown server error.', 500, res);
            },
//            securityHandlers: {
//            },
            operations: {
                get_service_status: async function(req, res) { return try_function(req, res, apiResponseController.getStatus); },
                get_service_info: async function(req, res) { return try_function(req, res, apiResponseController.getInfo); },

            }
        });

        // Start listening on port
        return new Promise(function(resolve, reject) {
            app.listen(app.get('port'), function() {
                config.log.info(context, 'AIRR Knowledge API (' + config.info.version + ') service listening on port ' + app.get('port'), true);
                resolve();
            });
        });
    })
    .then(function() {
        // Initialize queues

    })
    .catch(function(error) {
        var msg = config.log.error('Error occurred while initializing API service.\nSystem may need to be restarted.\n' + error);
        webhookIO.postToSlack(msg);
        // let it continue in case its a temporary error
        //process.exit(1);
    });

// WebsocketIO
//require('./utilities/websocketManager');

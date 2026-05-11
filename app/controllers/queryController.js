'use strict';

//
// queryController.js
// Handle standard query requests
//
// AIRR Knowledge API Service
// https://airr-knowledge.org
//
// Copyright (C) 2026 The University of Texas Southwestern Medical Center
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

var QueryController = {};
module.exports = QueryController;

// Server config
var config = require('../config/config');

// Tapis
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis();
var ServiceAccount = tapisIO.serviceAccount;
var GuestAccount = tapisIO.guestAccount;
var authController = tapisIO.authController;
var webhookIO = require('vdj-tapis-js/webhookIO');

var pgIO = require('vdj-tapis-js/pgIO');

var apiResponseController = require('./apiResponseController');

// service status
QueryController.performQuery = async function (req, res) {
    var context = 'QueryController.performQuery';

    console.log(req.body);
    let filters = req.body['filters'];

    // transform the query input into a postgres query
    let results = [];
    try {
        var msg = null;
        var error = { message: '' };
        results = await pgIO.performQueryOperation(filters, error)
            .catch(function(e) {
                msg = config.log.error(context, e);
                return apiResponseController.sendError(msg, 500, res);
            });
        if (msg) return;

        if (!results) {
            let result_message = "Could not construct valid query. Error: " + error['message'];
            config.log.error(context, result_message);
            // queryRecord['status'] = 'reject';
            // queryRecord['message'] = result_message;
            // tapisIO.recordQuery(queryRecord);
            return apiResponseController.sendError(result_message, 400, res);
        }
    } catch (e) {
        let result_message = "Could not construct valid query: " + e;
        config.log.error(context, result_message);
        // queryRecord['status'] = 'reject';
        // queryRecord['message'] = result_message;
        // tapisIO.recordQuery(queryRecord);
        return apiResponseController.sendError(result_message, 400, res);
    }

    //console.log(results);

    // Return the results
    return res.status(200).json(results);
}

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
QueryController.performQuery = async function(req, res) {
    var context = 'QueryController.performQuery';

    //console.log(req.body);
    let filters = req.body['filters'];

    // TODO: limited query support at the moment
    if (!filters) return apiResponseController.sendError("Missing filters with query.", 400, res);
    if (filters['op'] != '=') return apiResponseController.sendError("Query not supported.", 400, res);
    if (!filters['content']) return apiResponseController.sendError("Invalid query.", 400, res); 
    if (!filters['content']['value']) return apiResponseController.sendError("Invalid query.", 400, res);

    // transform the query input into a postgres query
    let results = [];
    if (filters['content']['field'] == 'tcr.receptor.trb_chain.junction_aa') {
        results = await pgIO.restrictedQueryOperation(filters['content']['value']);
    } else if (filters['content']['field'] == 'tcr.receptor.tra_chain.junction_aa') {
        results = await pgIO.restrictedQueryOperation(null, filters['content']['value']);
    } else return apiResponseController.sendError("Query not supported.", 400, res);

    //console.log(results);

    // execute the query

    // transform the results and send back in response

    // Verify we can connect to database
    return res.status(200).json(results);
}

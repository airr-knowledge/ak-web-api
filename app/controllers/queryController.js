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

const { v4: uuidv4 } = require('uuid');

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
const pgSettings = require('../../vdj-tapis-js/pgSettings');

// perform AK query and return results
QueryController.performQuery = async function (req, res) {
    var context = 'QueryController.performQuery';

    console.log(req.body);
    let filters = req.body['filters'];

    // transform the query input into a postgres query
    let results = null;
    try {
        var msg = null;
        var error = { message: '' };
        results = await pgIO.performQueryOperation(filters, error)
            .catch(function(e) {
                msg = config.log.error(context, e.message);
                if (e && e['status'] == 'timeout') return apiResponseController.sendError(e, 400, res);
                else return apiResponseController.sendError(msg, 500, res);
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
    let data = {};
    data['Info'] = JSON.parse(JSON.stringify(config.info));
    data['Info']['partial_results'] = results['partial'];
    data['TCRpMHC'] = results['results'];

    // Return the results
    return res.status(200).json(data);
}

// perform AK query, save results to file and return download url
QueryController.performQueryDownload = async function (req, res) {
    var context = 'QueryController.performQueryDownload';
    var msg = null;

    console.log(req.body);
    let filters = req.body['filters'];

    // first perform a count query to see how big the data will be
    let results = null;
    try {
        var error = { message: '' };
        // do a count query to see how big
        results = await pgIO.performQueryOperation(filters, error, true)
            .catch(function(e) {
                msg = config.log.error(context, e);
                if (e && e['status'] == 'timeout') return apiResponseController.sendTimeout(e.message, 408, res, pgSettings.download_timeout / 1000);
                else return apiResponseController.sendError(msg, 500, res);
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

    // too big?
    if (results['count'] > pgSettings.max_download_results) {
        let result_message = { status: "max_exceeded", message: "Query results exceeds maximum allowable download (" + results['count'] + " > " + pgSettings.max_download_results +")" };
        return apiResponseController.sendTooLarge(result_message.message, 413, res, results['count'], pgSettings.max_download_results);
    }

    // perform query to file
    // TODO: paths should be parameterized
    var uuid = uuidv4();
    let filename = 'akc-query-' + uuid + '.tsv';
    let outpath = '/airrkb_download/' + filename;
    let download_url = 'https://api.airr-knowledge.org/akc/download/' + filename;
    let format = 'tsv'
    var result = await pgIO.performQueryToFile(filters, outpath, format)
        .catch(function(error) {
            msg = 'pgIO.performQueryToFile, error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        return apiResponseController.sendError(msg, 500, res);
    }

    let data = {};
    data['status'] = 'success';
    data['download_url'] = download_url;

    // Return the results
    return res.status(200).json(data);
}

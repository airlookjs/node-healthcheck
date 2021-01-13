// healthcheck.routes.js: return a 2xx response when your server is healthy, else send a 5xx response
import express from 'express';
import os from "os";
import { create } from 'xmlbuilder2'
import _ from 'lodash'

const NS_PER_SEC = 1e9;
const MS_PER_NS = 1e6;
export const STATUS_OK = 'OK'
export const STATUS_ERROR = 'ERROR'
export const STATUS_ERROR_CODE = 503
export const DEFAULT_TIMEOUT = 5000

export function make_checks(checksArray) {
    return checksArray.map(function(check) {
        return make_check(check);
    });
}

async function make_check(check) {
    
    const timeout = (typeof check.timeout === 'undefined') ? DEFAULT_TIMEOUT : check.timeout;

    const startTime = process.hrtime(); // start timer
    try {
        
        const timedOutHandler = new Promise((resolve, reject) => {
            setTimeout(function() {
                reject(new Error(`Check did not complete before timeout of ${timeout}ms`))
            }, timeout);
        });
    
        const resp = await Promise.race([check.checkFn(check), timedOutHandler])
        check.status = STATUS_OK
        check.message = `${check.description}: ${resp || 'OK'}`

    } catch(error) {
        check.status = STATUS_ERROR
        check.message = `${check.description} | ERROR was: ${error.message}` 
    }

    const timeDiff = process.hrtime(startTime); // end timer
    const timeDiffInNanoseconds = (timeDiff[0] * NS_PER_SEC) + timeDiff[1]; 

    check.responseinms = timeDiffInNanoseconds / MS_PER_NS;
    return _.pick(check, ['name', 'status', 'message', 'responseinms']);
}

export async function getStatus(healthchecks) {

    const checks = await Promise.all( make_checks(healthchecks) )

    return {
        applicationname: process.env.npm_package_name,
        applicationversion: process.env.npm_package_version,
        applicationstatus: (_.every(checks, ['status', STATUS_OK])) ? STATUS_OK : STATUS_ERROR,
        servername: os.hostname(), 
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        check: checks
    };
}


// TODO: export async function getFastifyHealthRoute(fastify, opts) {

export function getStatusXml(status) {
    const doc = create({status: status});
    return doc.end({ prettyPrint: true });
}

export const getExpressHealthRoute = function(healthchecks) {

    const router = express.Router({})

    router.get('/', async (_req, res, _next) => {

        const status = await getStatus(healthchecks)
    
        if(status.applicationstatus != STATUS_OK) {
            res.status(STATUS_ERROR_CODE)
        }
        
        const jsonResponse = function() {
            res.json({status: status})
        } 

        res.format({
            xml: function() {
                res.send(getStatusXml())
            },
            json: jsonResponse,
            default: jsonResponse
          })

    });

    return router
}
export default getExpressHealthRoute
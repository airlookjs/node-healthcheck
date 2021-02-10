// healthcheck.routes.js: return a 2xx response when your server is healthy, else send a 5xx response
import express from 'express';
import os from "os";
import { create } from 'xmlbuilder2'
import _ from 'lodash'

const NS_PER_SEC = 1e9;
const MS_PER_NS = 1e6;
export const STATUS_OK = 'OK'
export const STATUS_ERROR = 'ERROR'
export const STATUS_WARNING = 'WARNING'
export const STATUS_ERROR_CODE = 503
export const DEFAULT_TIMEOUT = 5000

const STATUS_VALUES = [STATUS_OK, STATUS_WARNING, STATUS_ERROR]

const timeout = (prom, time, exception) => {
    let timer;
    return Promise.race([
        prom,
        new Promise((_r, rej) => timer = setTimeout(rej, time, exception))
    ]).finally(() => clearTimeout(timer));
}

export function make_checks(checksArray) {
    return checksArray.map(function(check) {
        return make_check(_.clone(check));
    });
}

async function make_check(check) {
        
        const timeout_ms = (typeof check.timeout === 'undefined') ? DEFAULT_TIMEOUT : check.timeout
        const message_prefix = (typeof check.description === 'undefined') ? "" : check.description + ":"

        const startTime = process.hrtime() // start timer

        const checkFnPromise = new Promise(async (resolve, reject) => {
            try {
                const res = await check.checkFn(check)
                resolve(res)
            } catch(error) {
                reject(error) 
            }
        })

        const timeoutError = Symbol()
        try {
            
            const resp = await timeout(checkFnPromise, timeout_ms, timeoutError)

            if(!check.status) {
                check.status = STATUS_OK
            }
            if(!check.message) {
                check.message = `${message_prefix} ${resp || 'OK'}`
            }

        } catch (error) {
            if( check.warnOnError ) {
                check.status = STATUS_WARNING
            } else  {
                check.status = STATUS_ERROR
            }

            if (error === timeoutError) {
                check.message = `${message_prefix} ERROR was: Check did not complete before timeout of ${timeout_ms}ms` 
            } else {
                check.message = `${message_prefix} ERROR was: ${error.message}` 
            }
        }

        const timeDiff = process.hrtime(startTime); // end timer
        const timeDiffInNanoseconds = (timeDiff[0] * NS_PER_SEC) + timeDiff[1]

        check.responseinms = timeDiffInNanoseconds / MS_PER_NS

        return _.pick(check, ['name', 'status', 'message', 'responseinms'])
}

const getAppStatus = (checks) => {
    if( _.some(checks, ['status', STATUS_ERROR]) ) {
        return STATUS_ERROR
    }
    if( _.some(checks, ['status', STATUS_WARNING]) ) {
        return STATUS_WARNING
    }
    return STATUS_OK
}

export async function getStatus(healthchecks) {

    const checks = await Promise.all( make_checks(healthchecks) )
    
    return {
        applicationname: process.env.npm_package_name,
        applicationversion: process.env.npm_package_version,
        applicationstatus: getAppStatus(checks),
        servername: os.hostname(), 
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        check: checks
    };
}

export function getStatusXml(status) {
    const doc = create({status: status});
    return doc.end({ prettyPrint: true });
}

export const getExpressHealthRoute = function(healthchecks) {

    const router = express.Router({})

    router.get('/', async (_req, res, _next) => {
        const status = await getStatus(healthchecks)
    
        if(status.applicationstatus === STATUS_ERROR) {
            res.status(STATUS_ERROR_CODE)
        }
        
        const jsonResponse = function() {
            res.json({status: status})
        } 

        res.format({
            xml: function() {
                res.send(getStatusXml(status))
            },
            json: jsonResponse,
            default: jsonResponse
          })

    });
    return router
}
export default getExpressHealthRoute
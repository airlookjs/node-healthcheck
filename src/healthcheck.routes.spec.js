import sinon from 'sinon'
import should from 'should'
import express from 'express'
import request from 'supertest'
import { create } from 'xmlbuilder2'

import { getExpressHealthRoute, STATUS_ERROR, STATUS_OK, STATUS_ERROR_CODE, DEFAULT_TIMEOUT, STATUS_WARNING} from './healthcheck.routes'
    
describe('healthcheck.routes', function() {

    const checkThatWillFail = {
        name: "Might never work",
        description: "Change a const",
        checkFn: function() {
            const breakfast = "";
            breakfast = "just constant eggs"
        }
    }

    const checkThatWillWarn = {
        name: "Warning",
        description: "Will return a warning on throw, preset",
        warnOnError: true,

        checkFn: function() {
            const breakfast = "";
            breakfast = "just constant eggs"
        }
    }

    const checkThatWillSucceed = {
            name: "yay",
            description: "It will be fine",
            checkFn: function() {
                if(true) return "All good"
            }
    }

    const checkThatWillTimeout = {
        name: "will we make it in time",
        description: "running late",
        timeout: 100,
        checkFn: async function() {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    it('status endpoint should return xml and encode date as ISO8601', async function(){
        const app = express();

        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillSucceed]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(200)

        const status = create(res.text).end({ format: 'object' }).status

        status.should.be.an.Object()
        status.check.should.be.an.Object()
        status.timestamp.should.be.a.String()
        status.applicationstatus.should.equal(STATUS_OK);

        new Date(status.timestamp).toISOString().should.equal(status.timestamp)
    
    });

    it('status endpoint should return json and encode date as ISO8601', async function(){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillSucceed]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect('Content-Type', /json/)
        .expect(200)

        // validate json
        res.body.status.should.be.an.Object()
        res.body.status.timestamp.should.be.a.String()
        new Date(res.body.status.timestamp).toISOString().should.equal(res.body.status.timestamp)
    
    });


    it('if any check returns STATUS_ERROR, applicationstatus should be ERROR', async function(){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillFail]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)

        res.body.status.applicationstatus.should.equal(STATUS_ERROR);
        
    });


    it('if all checks return status OK, applicationstatus should be OK', async function(){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillSucceed]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(200)

        res.body.status.applicationstatus.should.equal(STATUS_OK);


    });


    it('check should time out', async function(){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillTimeout]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        
        res.body.status.applicationstatus.should.equal(STATUS_ERROR);

    });

    it('check should time out with default time out if it never returns', async function(){

        this.timeout(DEFAULT_TIMEOUT + 1000); 

        const checkThatWillNeverFinish = {
            name: "won't ever make it",
            description: "eternal loop",
            checkFn: async function() {
                await new Promise(() => {})
            }
        }

        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillNeverFinish]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)

        res.body.status.applicationstatus.should.equal(STATUS_ERROR);

    });

    it('status endpoint should warn, flag set in check object', async function(){
        const app = express();

        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillWarn]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(200)

        const status = create(res.text).end({ format: 'object' }).status
        status.should.be.an.Object()
        status.check.should.be.an.Object()
        status.timestamp.should.be.a.String()
        status.applicationstatus.should.equal(STATUS_WARNING);
    });

    it('status endpoint should return most severe status', async function(){
        const app = express();

        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillWarn, checkThatWillFail]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(STATUS_ERROR_CODE)

        const status = create(res.text).end({ format: 'object' }).status

        status.should.be.an.Object()
        status.check.should.be.an.Object()
        status.timestamp.should.be.a.String()
        status.applicationstatus.should.equal(STATUS_ERROR);
    });
      

    it('check should warn with flag set in function', async function(){
        const app = express();

        const checkThatWillWarnInteractive = {
            name: "Warning",
            description: "Will return a warning on throw, interactive",
    
            checkFn: function(check) {
                check.warnOnError = true
                const breakfast = "";
                breakfast = "just constant eggs"
            }
        }

        app.use('/', getExpressHealthRoute([checkThatWillWarnInteractive]) );

        const res = await request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(200)
        
        const status = create(res.text).end({ format: 'object' }).status

        status.should.be.an.Object()
        status.check.should.be.an.Object()
        status.timestamp.should.be.a.String()
        status.applicationstatus.should.equal(STATUS_WARNING);

    });

    it('check status and message can be overridden manually', async function(){
        const app = express();

        let customWarn = true
        const customMessage = "this is just a warning"
        
        const checkWithManualOverrides = {
            name: "a check",
            description: "this is the check description",
    
            checkFn: function(check) {
                if(customWarn) {
                    check.message = customMessage
                    check.status = STATUS_WARNING
                }
            }
        }

        app.use('/', getExpressHealthRoute([checkWithManualOverrides]) );

        let res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(200)
        
        let status = res.body.status
        status.applicationstatus.should.equal(STATUS_WARNING)

        status.check[0].message.should.equal(customMessage)
        status.check[0].status.should.equal(STATUS_WARNING)

        customWarn = false
        res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(200)
        
        status = res.body.status
        status.applicationstatus.should.equal(STATUS_OK)
        status.check[0].status.should.equal(STATUS_OK)


    });


   it('sample application with test that checks variables', async function(){
        let appWarning = false
        let appError = false

        const appTest = {
            name: "check for error or warning",
            checkFn: function(check) {
                if(appError) {
                    throw new Error("warning")
                } else if(appWarning) {
                    check.warnOnError = true
                    throw new Error("error")
                }
            }
        }

        const app = express();
        app.use('/', getExpressHealthRoute([appTest]) );

        let res = await request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(200)
        res.body.status.applicationstatus.should.equal(STATUS_OK);

        appWarning = true;
        res = await request(app).get('/')
          .set({"Accept":"application/json"})
          .expect(200)
        res.body.status.applicationstatus.should.equal(STATUS_WARNING);
        
        appError = true
        res = await request(app).get('/')
            .set({"Accept":"application/json"})
            .expect(STATUS_ERROR_CODE)
        res.body.status.applicationstatus.should.equal(STATUS_ERROR);

        appError = false
        appWarning = false
        res = await request(app).get('/')
            .set({"Accept":"application/json"})
            .expect(200)
        res.body.status.applicationstatus.should.equal(STATUS_OK);

    });


});
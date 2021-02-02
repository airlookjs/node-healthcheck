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

    const checkThatWillWarnInteractive = {
        name: "Warning",
        description: "Will return a warning on throw, interactive",

        checkFn: function(check) {
            check.warnOnError = true
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



    it('status endpoint should return xml', function(done){
        const app = express();

        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillSucceed]) );

        request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(200)
        .end(function(err, res) {

            console.log("test return")
            if (err) return done(err);
            const docObj = create(res.text).end({ format: 'object' })

            docObj.status.should.be.an.Object()
            docObj.status.check.should.be.an.Object()
            docObj.status.timestamp.should.be.a.String()
            docObj.status.applicationstatus.should.equal(STATUS_OK);

            return done()
          });
    
    });

    it('status endpoint should return json, and encode date as ISO8601', function(done){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillSucceed]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            // validate json
            res.body.status.should.be.an.Object()
            res.body.status.timestamp.should.be.a.String()
            new Date(res.body.status.timestamp).toISOString().should.equal(res.body.status.timestamp)
            done();
          });
    
    });


    it('if any check does not return status OK, applicationstatus should be ERROR', function(done){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillFail]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.status.applicationstatus.should.equal(STATUS_ERROR);
            done()
          });
        
    });


    it('if all checks return status OK, applicationstatus should be OK', function(done){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillSucceed]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.status.applicationstatus.should.equal(STATUS_OK);
            done()
          });

    });


    it('check should time out', function(done){
        const app = express();
        app.use('/', getExpressHealthRoute([checkThatWillTimeout]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.status.applicationstatus.should.equal(STATUS_ERROR);
            done()
          });

    });

    it('check should time out with default time out if it never returns', function(done){

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

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.status.applicationstatus.should.equal(STATUS_ERROR);
            done()
          });

    });

    it('status endpoint should warn', function(done){
        const app = express();

        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillWarn]) );

        request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            const docObj = create(res.text).end({ format: 'object' })

            docObj.status.should.be.an.Object()
            docObj.status.check.should.be.an.Object()
            docObj.status.timestamp.should.be.a.String()
            docObj.status.applicationstatus.should.equal(STATUS_WARNING);

            done()
          });
    
    });

    it('status endpoint should return most severe status', function(done){
        const app = express();

        app.use('/', getExpressHealthRoute([checkThatWillSucceed, checkThatWillWarn, checkThatWillFail]) );

        request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            const docObj = create(res.text).end({ format: 'object' })

            docObj.status.should.be.an.Object()
            docObj.status.check.should.be.an.Object()
            docObj.status.timestamp.should.be.a.String()
            docObj.status.applicationstatus.should.equal(STATUS_ERROR);

            done()
          });
    
    });
      

    it('check can override check object in check method', function(done){
        const app = express();

        app.use('/', getExpressHealthRoute([checkThatWillWarnInteractive]) );

        request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            const docObj = create(res.text).end({ format: 'object' })

            docObj.status.should.be.an.Object()
            docObj.status.check.should.be.an.Object()
            docObj.status.timestamp.should.be.a.String()
            docObj.status.applicationstatus.should.equal(STATUS_WARNING);

            done()
          });
    });



   /* it('check can be called multiple times', function(done){
        let testValue = 0;

        const interactiveTest = {
            name: "fail on 1, warn on 2",
            checkFn: function() {
                if(testValue === 0) {
                    return
                } else if(testValue === 1) {
                    
                }
            }
        }

        const app = express();
        app.use('/', getExpressHealthRoute([interactiveTest]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.status.applicationstatus.should.equal(STATUS_ERROR);
            done()
          });

    });*/


});
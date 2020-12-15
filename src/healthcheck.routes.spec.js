import sinon from 'sinon'
import should from 'should'
import express from 'express'
import request from 'supertest'
import getHealthRouter, {STATUS_ERROR, STATUS_OK, STATUS_ERROR_CODE, DEFAULT_TIMEOUT} from './healthcheck.routes'

describe('healthcheck.routes', function() {

    const checkThatWillFail = {
        name: "Might never work",
        description: "Change a const",
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

    it('status endpoint should return xml', function(done){
        const app = express();

        app.use('/', getHealthRouter([checkThatWillSucceed, checkThatWillSucceed]) );

        request(app).get('/')
        .set({"Accept":"application/xml"})
        .expect('Content-Type', /xml/)
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            //TODO: validate xml
            done()
          });
    
    });

    it('status endpoint should return json', function(done){
        const app = express();
        app.use('/', getHealthRouter([checkThatWillSucceed, checkThatWillSucceed]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            //TODO: validate json 
            done()
          });
    
    });


    it('if any check does not return status OK, applicationstatus should be ERROR', function(done){
        const app = express();
        app.use('/', getHealthRouter([checkThatWillSucceed, checkThatWillFail]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.applicationstatus.should.equal(STATUS_ERROR);
            done()
          });
        
    });


    it('if all checks return status OK, applicationstatus should be OK', function(done){
        const app = express();
        app.use('/', getHealthRouter([checkThatWillSucceed, checkThatWillSucceed]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.applicationstatus.should.equal(STATUS_OK);
            done()
          });

    });


    it('check should time out', function(done){
        const app = express();
        app.use('/', getHealthRouter([checkThatWillTimeout]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.applicationstatus.should.equal(STATUS_ERROR);
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
        app.use('/', getHealthRouter([checkThatWillNeverFinish]) );

        request(app).get('/')
        .set({"Accept":"application/json"})
        .expect(STATUS_ERROR_CODE)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.applicationstatus.should.equal(STATUS_ERROR);
            done()
          });

    });
      
});
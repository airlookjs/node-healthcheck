import sinon from 'sinon'
import should from 'should'
import express from 'express'
import request from 'supertest'
import getHealthRouter, {STATUS_ERROR, STATUS_OK} from './healthcheck.routes'

describe('healthcheck.routes', function() {

    var app = express();

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

    app.use('/status', getHealthRouter([checkThatWillSucceed, checkThatWillSucceed]) );
    app.use('/statuswitherror', getHealthRouter([checkThatWillSucceed, checkThatWillFail]) );

    it('status endpoint should return xml', function(done){

        request(app).get('/status')
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

        request(app).get('/status')
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

        request(app).get('/statuswitherror')
        .set({"Accept":"application/json"})
        .expect(503)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.applicationstatus.should.equal(STATUS_ERROR);
            done()
          });
        
    });


    it('if all checks return status OK, applicationstatus should be OK', function(done){

        // set something so we 
        request(app).get('/status')
        .set({"Accept":"application/json"})
        .expect(200)
        .end(function(err, res) {
            if (err) return done(err);
            res.body.applicationstatus.should.equal(STATUS_OK);
            done()
          });

    });
      
});
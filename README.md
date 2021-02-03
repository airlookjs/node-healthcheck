Health / status endpoints for DR node applications, following XML scom standard. 

See a live example running at: https://ghub.gmab.net.dr.dk/status

## Installation:

    $ echo \"@give-me-a-break:registry\" \"https://gitlab.gmab.net.dr.dk/api/v4/packages/npm/\" >> .yarnrc

    $ yarn add '@give-me-a-break/dr-node-healthcheck'


## Usage


### Simple check
The simplest check has just a name and a check function.
```javascript
const check = {
    name: `Check directory exists`,
    checkFn: function() {
            if (!fs.existsSync("/tmp/dir")) {
                throw new Error(`/tmp/dir does not exist`)
            }
        }
}
```
Optionally the check may have a description that is prepended to the output status message. 


### timeouts
A specific timeout that the function should execute within to not return a timeout error can be set. The library sets a default timeout of 5000 ms. 

```javascript
const check = {
    name: `Check should complete very quickly`,
    timeout: 200,
    checkFn: function() {
            await fastFunction()
        }
}
```


### returning status
By default a succesfull check return the message 'OK', return a string to set a custom message. The output message is concatenated from the description and the message.  

```javascript
const check = {
    name: `API connectivity check `,
    description: `Check that localhost can reach API`
    checkFn: function() {
            const resp = await api.get('/')
            return 'test succesfull'
        }
}
```

Returns message on succesfull check: "Check that localhost can reach API: test succesfull"


The message can also be overwritten completely

```javascript
const check = {
    name: `API connectivity check `,
    description: `Check that localhost can reach API`
    checkFn: function(check) {
            const resp = await api.get('/')
            check.message = "we ain't got no problem"
        }
}
```

### Status levels
The library supports an OK, ERROR and WARNING state. 
OK is produced from a check running with no undcaught errors and no timeout. 
ERROR is produced when the check function throws or times out. 

Warning is produced by setting the flag warnOnError and then throwing. 

```javascript
const check = {
    name: `storage check`,
    checkFn: function(check) {
            const availableBytes = getFreeStorage()
            
            if (availableBytes < config.criticalStorageLimit) {
                throw new Error("Storage is critically low, application will malfunction")
            }
            if (availableBytes < config.warningStorageLimit) {
                check.warnOnError = true
                throw new Error("Storage is low, clean up soon")
            }
            
        }
}
```

All status outputs may also be set manually without throwing. 

```javascript
const check = {
    name: `storage check`,
    checkFn: function(check) {
            const availableBytes = getFreeStorage()
            
            if (availableBytes < config.criticalStorageLimit) {
                check.status = "ERROR"
            }
            if (availableBytes < config.warningStorageLimit) {
                check.status = "WARNING"
            }
            check.status = "OK"
            
        }
}
```

A custom status may also be set but at the moment the applicationstatus only works for the following states "OK", "ERROR", "WARNING". Most severe state is always reported as applicationstatus   

### Using express router and multiple application tests:

```javascript
import express from 'express'
import cors from 'cors'
import { getExpressHealthRoute } from '@give-me-a-break/dr-node-healthcheck'

const app = express()
app.use(cors())

const checks = [{
    name: `Connection to folder`,
    description: `Is directory readable at ${config.paths.renderTemp}`,
    checkFn: function() {
            if (!fs.existsSync(config.paths.renderTemp)) {
                throw new Error(`RenderTemp folder could not be accessed.`)
            }
        }
},
{
    name: `Connection to PixelPower playout server 1`,
    description: `Is directory readable at ${config.paths.pixelpower.media.server1}`,
    checkFn: function() {
        if (!fs.existsSync(config.paths.pixelpower.media.server1)) {
            throw new Error(`Connection not established`)
        }        
    }
},
{
    name: `Connection to airlook API`, 
    description: `Can fetch data from endpoint at ${config.AIRlOOK_API_ENDPOINT}gmaboutputs`,
    checkFn: async function() { 
        await api.get('gmaboutputs')
        return "Data fetched"
    }
},
]

app.use('/status', getExpressHealthRoute(checks));

```

The status endpoint will return either xml or json depneding on the Accept header in the request. An ERROR state is returned with code 503 Service unavailable. 
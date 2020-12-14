health endpoints for DR node applications, following XML scom standard 

Usage example:

```javascript
import express from 'express'
import cors from 'cors'
import getHealthRouter from './healthcheck.routes'

const app = express()
app.use(cors())

const checks = [{
    name: `Connection to renderTemp`,
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

app.use('/status', getHealthRouter(checks));

...
```
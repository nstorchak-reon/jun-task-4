import express from 'express'
import { config } from './config'
import { api } from './api'
import { mainLogger } from './logger'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/login', async (req, res) => {
    const authCode = String(req.query.code)
    const subDomain = String(req.query.referer).split('.')[0]
    await api.getCodeSubdomain(authCode, subDomain)
    await api.getAccessToken().then(async () => {
        const result = await api.getAccountData()
        console.log(result)
        const min = Math.ceil(0)
        const max = Math.floor(3)
        const re = Math.floor(Math.random() * (max - min) + min)
        console.log(re, 678)
        res.send(`${result._embedded.contacts[re].id}`)
    })
})
app.get('/quit', async (req, res) => {
    await api.quit()
    res.send('Вы вышли из аккаунта')
})
app.listen(config.PORT, () =>
    mainLogger.debug('Server started on ', config.PORT)
)

//https://www.amocrm.ru/oauth?client_id=faf69456-9f21-4835-aaa8-e41c1232a889&state=state&mode=popup.

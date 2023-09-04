import axios from 'axios'
import { config } from './config'
import fs from 'fs'

const ACCOUNT = {
    account_id: '',
}

const AUTH_CONFIG = {
    client_id: config.CLIENT_ID,
    client_secret: config.CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: config.AUTH_CODE,
    redirect_uri: config.REDIRECT_URI,
    subDomain: config.SUB_DOMAIN,
    amoTokenPath: `${ACCOUNT.account_id}_amo_token.json`,
    rootPath: `https://${config.SUB_DOMAIN}.amocrm.ru`,
    accessToken: '',
    refreshToken: '',
}

const authChecker = <T extends unknown[], D>(
    request: (...args: T) => Promise<D>
) => {
    return async (...args: T): Promise<D> => {
        if (!AUTH_CONFIG.accessToken) {
            return await getAccessToken().then(() =>
                authChecker(request)(...args)
            )
        }
        return request(...args).catch((err: any) => {
            console.error(err.response)
            console.error(err)
            console.error(err.response.data)
            const data = err.response.data
            if ('validation-errors' in data) {
                console.error('args', JSON.stringify(args, null, 2))
            }
            if (data.status == 401 && data.title === 'Unauthorized') {
                console.debug('Нужно обновить токен')
                return refreshToken().then(() => authChecker(request)(...args))
            }
            throw err
        })
    }
}

const requestAccessToken = async () => {
    return axios
        .post(`${AUTH_CONFIG.rootPath}/oauth2/access_token`, AUTH_CONFIG)
        .then((res) => {
            console.log('Свежий токен получен')
            return res.data
        })
        .catch((err) => {
            console.error(err.response.data)
            throw err
        })
}

const getAccessToken = async () => {
    if (AUTH_CONFIG.accessToken) {
        return Promise.resolve(AUTH_CONFIG.accessToken)
    }
    try {
        const content = fs.readFileSync(AUTH_CONFIG.amoTokenPath).toString()
        const token = JSON.parse(content)
        AUTH_CONFIG.accessToken = token.access_token
        AUTH_CONFIG.refreshToken = token.refresh_token
        return Promise.resolve(token)
    } catch (error) {
        console.error(
            `Ошибка при чтении файла ${AUTH_CONFIG.amoTokenPath}`,
            error
        )
        console.debug('Попытка заново получить токен')
        const token = await requestAccessToken()
        AUTH_CONFIG.accessToken = token.access_token
        AUTH_CONFIG.refreshToken = token.refresh_token
        await getAccount()
        if (ACCOUNT.account_id) {
            fs.writeFileSync(AUTH_CONFIG.amoTokenPath, JSON.stringify(token))
        }
        return Promise.resolve(token)
    }
}
const getAccount = async () => {
    return axios
        .get(`https://www.amocrm.ru/oauth2/account/subdomain`, {
            headers: {
                Authorization: `Bearer ${AUTH_CONFIG.accessToken}`,
            },
        })
        .then((res) => {
            console.debug('Пользователь авторизован')
            ACCOUNT.account_id = res.data.id
            AUTH_CONFIG.amoTokenPath = `${ACCOUNT.account_id}_amo_token.json`
        })
        .catch((err) => {
            console.error('Пользователь не авторизован')
            console.error(err.response.data)
        })
}

const getCodeSubdomain = (code: string, subDomain: string) => {
    AUTH_CONFIG.code = code
    AUTH_CONFIG.subDomain = subDomain
}
const quit = async () => {
    if (AUTH_CONFIG.accessToken) {
        fs.unlink(`${AUTH_CONFIG.amoTokenPath}`, (err) => {
            if (err) throw err
            console.log('Файл удален')
        })
    }
}
const refreshToken = async () => {
    return axios
        .post(`${AUTH_CONFIG.rootPath}/oauth2/access_token`, AUTH_CONFIG)
        .then((res) => {
            console.debug('Токен успешно обновлен')
            const token = res.data
            fs.writeFileSync(AUTH_CONFIG.amoTokenPath, JSON.stringify(token))
            AUTH_CONFIG.accessToken = token.access_token
            AUTH_CONFIG.refreshToken = token.refresh_token
            return token
        })
        .catch((err) => {
            console.error('Не удалось обновить токен')
            console.error(err.response.data)
        })
}
const getAccountData = authChecker(async () => {
    return axios
        .get(`${AUTH_CONFIG.rootPath}/api/v4/contacts`, {
            headers: {
                Authorization: `Bearer ${AUTH_CONFIG.accessToken}`,
            },
        })
        .then((res) => res.data)
})

export const api = {
    authChecker,
    getCodeSubdomain,
    requestAccessToken,
    getAccessToken,
    quit,
    refreshToken,
    getAccountData,
}

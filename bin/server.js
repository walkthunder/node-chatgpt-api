#!/usr/bin/env node
import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { FastifySSEPlugin } from "@waylaidwanderer/fastify-sse-v2";
import fs from 'fs';
import path from 'path';
import CryptoJS from "crypto-js";
import { pathToFileURL } from 'url'
import Keyv from 'keyv';
import ChatGPTClient from '../src/ChatGPTClient.js';
import ChatGPTBrowserClient from '../src/ChatGPTBrowserClient.js';
import BingAIClient from '../src/BingAIClient.js';
import { KeyvFile } from 'keyv-file';
// import { ProxyAgent } from 'undici';

const BillingURL = 'https://api.openai.com/dashboard/billing/credit_grants';

const arg = process.argv.find((arg) => arg.startsWith('--settings'));
let settingPath;
if (arg) {
    settingPath = arg.split('=')[1];
} else {
    settingPath = './settings.js';
}

let settings;
if (fs.existsSync(settingPath)) {
    // get the full settingPath
    const fullPath = fs.realpathSync(settingPath);
    settings = (await import(pathToFileURL(fullPath).toString())).default;
} else {
    if (arg) {
        console.error(`Error: the file specified by the --settings parameter does not exist.`);
    } else {
        console.error(`Error: the settings.js file does not exist.`);
    }
    process.exit(1);
}

if (settings.storageFilePath && !settings.cacheOptions.store) {
    // make the directory and file if they don't exist
    const dir = settings.storageFilePath.split('/').slice(0, -1).join('/');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(settings.storageFilePath)) {
        fs.writeFileSync(settings.storageFilePath, '');
    }

    settings.cacheOptions.store = new KeyvFile({ filename: settings.storageFilePath });
}

const clientToUse = settings.apiOptions?.clientToUse || settings.clientToUse || 'chatgpt';

let client;
switch (clientToUse) {
    case 'bing':
        client = new BingAIClient(settings.bingAiClient);
        break;
    case 'chatgpt-browser':
        client = new ChatGPTBrowserClient(
            settings.chatGptBrowserClient,
            settings.cacheOptions,
        );
        break;
    default:
        settings.cacheOptions.namespace = settings.cacheOptions.namespace || 'chatgpt';
        const conversationsCache = new Keyv(settings.cacheOptions);
        if (settings.openaiApiKey?.indexOf(',') > -1) {
            const keys = settings.openaiApiKey.split(',');
            client = [];
            keys.forEach(k => {
                client.push(new ChatGPTClient(
                    k,
                    conversationsCache,
                    settings.chatGptClient,
                    settings.cacheOptions,
                ));
            });
        } else {
            client = new ChatGPTClient(
                settings.openaiApiKey,
                conversationsCache,
                settings.chatGptClient,
                settings.cacheOptions,
            );
        }

        break;
}

const server = fastify();

await server.register(FastifySSEPlugin);

await server.register(fastifyStatic, {
    root: fs.realpathSync('.'),
    prefix: '/'
})
await server.register(cors, {
    origin: '*',
});

server.get('/', async (req, res) => {
    res.code(200);
    res.send('ok')
})
server.get('/MP_verify_ucmvXzViscnLif9o.txt', async (req, reply) => {
    return reply.sendFile("MP_verify_ucmvXzViscnLif9o.txt");
})

server.post('/api/usage', async (request, reply) => {
    const { hash } = request.body || {}
    if (hash !== 'magic-master') {
        reply.code(400).send(error?.message || 'Auth Failed')
        return;
    }
    if (!settings.openaiApiKey) {
        reply.code(500).send('Config Error')
        return;
    }
    console.log('query user credits...');
    if (settings.openaiApiKey?.indexOf(',') > -1) {
        const keys = settings.openaiApiKey.split(',');
        const promises = keys.map(k => {
            return fetch(
                BillingURL,
                {
                    method: 'GET',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${k}`
                      }
                },                    
            ).then(resp => resp.json())
            .then(resp => ({
                id: k,
                credits: resp
            }))
        });
        const resp = await Promise.all(promises);
        console.log('query done accounts: ', resp);
        reply.send(resp);
    } else {
        const resp = await fetch(
            BillingURL,
            {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openaiApiKey}`
                  },
                //   dispatcher: new ProxyAgent({
                //     uri: 'http:/127.0.0.1:58591'
                // }),
            },
        ).then(resp => resp.json())
        .then(resp => ({
            id: settings.openaiApiKey,
            credits: resp
        }));
        console.log('query done account: ', resp);
        reply.send(resp);
    }
})

server.post('/api/chat', async (request, reply) => {
    console.log('api chat message - ', JSON.stringify(request.body));
    try {
        const { hash } = request.body || {}
        if (!hash) {
            throw new Error('Not Authorized')
        }
        console.log('hash and salt: ', hash);
        const bytes  = CryptoJS.AES.decrypt(hash, process.env.CHAT_SALT);
        console.log('request decrypt: ', bytes);
        const { id, openId, left, date } = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        console.log('request hash data: ', id, openId, left, date);
        if (!id || !openId || (left <= 0)) {
            throw new Error('Invalid Hash Data')
        }
        if (Math.abs(new Date().valueOf() - Number(date)) > 20000) {
            throw new Error('Outdated Request')
        }
        // Continue biz
    } catch (error) {
        reply.code(400).send(error?.message || 'Auth Failed')
        return;
    }

    const body = request.body || {};
    const abortController = new AbortController();

    reply.raw.on('close', () => {
        if (abortController.signal.aborted === false) {
            abortController.abort();
        }
    });

    let onProgress;
    if (body.stream === true) {
        onProgress = (token) => {
            if (settings.apiOptions?.debug) {
                console.debug(token);
            }
            if (token !== '[DONE]') {
                reply.sse({ id: '', data: JSON.stringify(token) });
            }
        };
    } else {
        onProgress = null;
    }

    let result;
    let error;
    try {
        if (!body.message) {
            const invalidError = new Error();
            invalidError.data = {
                code: 400,
                message: 'The message parameter is required.',
            };
            // noinspection ExceptionCaughtLocallyJS
            throw invalidError;
        }
        const parentMessageId = body.parentMessageId ? body.parentMessageId.toString() : undefined;
        let targetClient = client;
        if (Array.isArray(client)) {
            targetClient = client[Math.floor(Math.random() * client.length)]
        }
        result = await targetClient.sendMessage(body.message, {
            conversationId: body.conversationId ? body.conversationId.toString() : undefined,
            parentMessageId,
            conversationSignature: body.conversationSignature,
            clientId: body.clientId,
            invocationId: body.invocationId,
            onProgress,
            abortController,
        });
    } catch (e) {
        error = e;
    }

    if (result !== undefined) {
        if (settings.apiOptions?.debug) {
            console.debug(result);
        }
        if (body.stream === true) {
            reply.sse({ event: 'result', id: '', data: JSON.stringify(result) });
            reply.sse({ id: '', data: '[DONE]' });
            await nextTick();
            return reply.raw.end();
        }
        return reply.send(result);
    }

    const code = error?.data?.code || 503;
    if (code === 503) {
        console.error(error);
    } else if (settings.apiOptions?.debug) {
        console.debug(error);
    }
    const message = error?.data?.message || `There was an error communicating with ${clientToUse === 'bing' ? 'Bing' : 'ChatGPT'}.`;
    if (body.stream === true) {
        reply.sse({
            id: '',
            event: 'error',
            data: JSON.stringify({
                code,
                error: message,
            }),
        });
        await nextTick();
        return reply.raw.end();
    }
    return reply.code(code).send({ error: message });
});

const port = settings.apiOptions?.port || settings.port || 3000

server.listen({
    port,
    host: settings.apiOptions?.host || 'localhost'
}, (error) => {
    console.log('server started: ', port)
    if (error) {
        console.error(error);
        process.exit(1);
    }
});

function nextTick() {
    return new Promise(resolve => setTimeout(resolve, 0));
}


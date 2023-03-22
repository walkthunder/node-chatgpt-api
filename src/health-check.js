import { trace } from './trace.js';

const MAX_SCORE = 10;
const MIN_SCORE = 0;
const MANAGER_HOST = 'https://api.my.webinfra.cloud';

let serviceId = '';
let serviceScore = 10;

const init = () => {
    serviceScore = 10;
    serviceId = '';
};

const register = () => {
    if (process.env.DEBUG) {
        return;
    }
    // eslint-disable-next-line consistent-return
    return fetch(`${MANAGER_HOST}/api/worker/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'user-agent': 'chat-node-server',
        },
        body: JSON.stringify({
            auth: 'auth-hash-str',
            url: process.env.SRV_URL, // 当前实例的服务地址
        }),
    })
        .then(resp => resp.json())
        .then((resp) => {
            console.log('register srv done with', resp);
            if (resp.success) {
                const instanceId = resp.data?.id;
                if (!instanceId) {
                    trace('worker_register_fail', {
                        message: JSON.stringify(resp),
                        url: process.env.SRV_URL,
                    });
                    throw new Error('register failed for no id generated');
                }
                serviceId = instanceId;
                trace('worker_register_done', {
                    url: process.env.SRV_URL,
                    id: serviceId,
                });
                return serviceId;
            }
            throw new Error('Register failed');
        })
        .catch((err) => {
            console.error('register exception caught: ', err);
        });
};

const crash = () => {
    if (process.env.DEBUG) {
        return;
    }
    if (!serviceId) {
        return;
    }
    // eslint-disable-next-line consistent-return
    return fetch(`${MANAGER_HOST}/api/worker/remove`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'user-agent': 'chat-node-server',
        },
        body: JSON.stringify({
            auth: 'auth-hash-str',
            id: serviceId, // 当前实例的服务地址
        }),
    })
        .then(resp => resp.json())
        .then((resp) => {
            console.log(`unregister srv done with ${resp?.data}`);
            if (resp.success) {
                trace('worker_register_done', {
                    url: process.env.SRV_URL,
                    id: serviceId,
                });
                serviceId = '';
                trace('worker_crash_done', {
                    id: serviceId,
                    url: process.env.SRV_URL,
                });
            }
            throw new Error('Report crash failed');
        })
        .catch((err) => {
            console.error('unregister exception caught: ', err);
            trace('worker_crash_fail', {
                id: serviceId,
                url: process.env.SRV_URL,
                message: JSON.stringify(err),
            });
        });
};

const registered = () => {
    console.log('service registered: ', serviceId);
    return serviceId;
};

const up = () => {
    serviceScore = Math.min(MAX_SCORE, serviceScore + 1);
    if (!serviceId) {
        register();
    }
};

const down = () => {
    serviceScore = Math.max(MIN_SCORE, serviceScore - 1);
    if (serviceScore === MIN_SCORE) {
        crash();
    }
};

const get = () => {
    console.log('get score: ', serviceScore, serviceId);
    return {
        serviceScore,
        serviceId,
    };
};

export default {
    init,
    up,
    down,
    get,
    register,
    registered,
};

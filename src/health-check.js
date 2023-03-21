const MAX_SCORE = 10;
const MIN_SCORE = 0;

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
    return fetch('https://prod-sdk-api.my.webinfra.cloud/api/worker/register', {
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
            console.log(`register srv done with ${resp?.data}`);
            const instanceId = resp?.id;
            if (!instanceId) {
                throw new Error('register failed for no id generated');
            }
            serviceId = instanceId;
            return serviceId;
        })
        .catch((err) => {
            console.error('register exception caught: ', err);
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
};

const get = () => {
    console.log('get score: ', serviceScore);
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

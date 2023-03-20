import './fetch-polyfill.js';
import { trace } from './trace.js';

const proxyList = [];
export const initProxy = (str) => {
    const envs = str || process.env.PROXY_LIST || '';
    if (!envs) {
        console.log('no proxy list configed from env');
        return null;
    }
    const list = envs.split(',').map((url) => {
        if (url) {
            return {
                url,
                score: 10,
            };
        }
        return null;
    }).filter(item => !!item);

    proxyList.splice(0, proxyList?.length, list);
    return proxyList;
};

export const listProxy = () => {
    console.log('list proxy in use: ', proxyList);
    return proxyList;
};

export const getAProxy = () => {
    const validList = proxyList.filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    if (validList.length === 0) {
        // TODO: Alert that no available proxy
        console.error('no valid proxy left');
        trace('proxy_exausted', {});
        return null;
    }
    // 暂时的策略是优先选择score最高的proxy
    const proxy = validList[0];
    console.log('try a new proxy: ', proxy);
    return proxy;
};

export const scoreProxy = (url, positive) => {
    const target = proxyList.find(item => item.url === url);
    if (!target) {
        return;
    }
    if (positive) {
        target.score = Math.min(10, target.score + 1);
    } else {
        target.score = Math.max(0, target.score - 1);
    }
    if (target.score === 0) {
        // TODO: Alert that a proxy is down
        trace('proxy_down', {
            url: target.url,
        });
    }
};

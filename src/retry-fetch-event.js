import './fetch-polyfill.js';
import { fetchEventSource } from '@waylaidwanderer/fetch-event-source';
import { ProxyAgent } from 'undici';
import { getAProxy, scoreProxy } from './ProxyManager.js';

// eslint-disable-next-line import/prefer-default-export
export const fetchEvt = async (url, opts) => {
    console.log('proxy fetch event', url);
    let retryCnt = opts?.retryCnt || 0;
    try {
        if (opts?.proxy) {
            console.log('fetch with proxy: ', opts.proxy);
            opts.dispatcher = new ProxyAgent(opts.proxy);
        }

        return await fetchEventSource(url, {
            ...opts,
            async onopen(response) {
                console.log('on open: ', response.status);
                if ((response.status > 400) && (response.status < 500)) {
                    if (retryCnt < 4) {
                        retryCnt += 1;
                        console.log('onopen retry...', retryCnt);
                        throw new Error('RetryRequest');
                    }
                }
                if (opts?.open) {
                    opts.open(response);
                }
            },
            onclose() {
                console.debug('Server closed the connection unexpectedly, returning...');
                if (opts?.onclose) {
                    opts.onclose();
                }
            },
            onerror(err) {
                // TODO: Error 类型做进一步区分，是否重试，这里先重试两次
                console.error('fetch evt source onerror: ', err);
                if (retryCnt > 2) {
                    if (opts?.onerror) {
                        opts.onerror(err);
                    }
                    return;
                }
                console.log('onerror retry...', retryCnt);
                retryCnt += 1;
                throw new Error('RetryRequest');
            },
            onmessage(message) {
                if ((message.data === '[DONE]')) {
                    scoreProxy(opts.proxy, true);
                }
                if (opts?.onmessage) {
                    opts.onmessage(message);
                }
            },
        }).catch((err) => {
            // hack way to catch error and retry with new parameters.
            console.error('internal error: ', err);
            throw err;
        });
    } catch (error) {
        console.log('error catch: ', error);
        if (error?.message === 'RetryRequest') {
            // Report a failed proxy node: score - 1
            scoreProxy(opts.proxy);
            // Get a new proxy
            const proxy = getAProxy();
            if (proxy) {
                return fetchEvt(url, { ...opts, proxy: proxy?.url, retryCnt });
            }
        }
        throw error;
    }
};

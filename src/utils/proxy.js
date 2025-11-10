import { ProxyAgent, Dispatcher, setGlobalDispatcher } from 'undici';

/**
* Returns an Undici Dispatcher for the given proxy URL (http/https/socks5).
* If no proxyUrl is provided, returns undefined to use default.
*/
export function getProxyDispatcher(proxyUrl) {
if (!proxyUrl) return undefined;
try {
const agent = new ProxyAgent(proxyUrl);
// We do not setGlobalDispatcher globally to avoid side-effects in host apps.
return agent;
} catch (e) {
// In case of invalid proxy URL, just return undefined.
return undefined;
}
}

// Optional: allow consumers to set a global proxy easily.
export function setGlobalProxy(proxyUrl) {
const agent = new ProxyAgent(proxyUrl);
setGlobalDispatcher(agent);
return agent;
}
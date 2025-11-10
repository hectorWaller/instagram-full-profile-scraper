import { fetch } from 'undici';
import { getProxyDispatcher } from './proxy.js';

export async function requestWithRetry(
url,
{
method = 'GET',
headers = {},
body = undefined,
timeoutMs = 20000,
maxRetries = 3,
backoffMs = 1000,
proxyUrl = null,
logger
} = {}
) {
let lastErr;
const dispatcher = getProxyDispatcher(proxyUrl);

for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
try {
const abort = new AbortController();
const t = setTimeout(() => abort.abort(), timeoutMs);
const res = await fetch(url, {
method,
headers,
body,
dispatcher,
signal: abort.signal
});
clearTimeout(t);

// If IG throws 429/403, retry with backoff
if (res.status >= 500 || res.status === 429 || res.status === 403) {
const text = await safeText(res);
logger?.warn({ status: res.status, url, attempt, text: text?.slice(0, 200) }, 'HTTP error, will retry if allowed');
if (attempt < maxRetries) {
await sleep(backoffMs * Math.pow(2, attempt));
continue;
}
}
return res;
} catch (err) {
lastErr = err;
logger?.warn({ attempt, url, err: err?.message }, 'Request failed, retrying if allowed');
if (attempt < maxRetries) {
await sleep(backoffMs * Math.pow(2, attempt));
continue;
}
break;
}
}
throw lastErr ?? new Error('request failed');
}

async function safeText(res) {
try {
return await res.text();
} catch {
return '';
}
}

function sleep(ms) {
return new Promise((r) => setTimeout(r, ms));
}
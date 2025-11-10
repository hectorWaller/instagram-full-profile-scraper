import { requestWithRetry } from '../utils/http.js';

export default async function fetchProfile({ username, proxyUrl, logger, config }) {
const baseUrl = config?.instagramBaseUrl || 'https://www.instagram.com';
const url = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(username)}/`;

const res = await requestWithRetry(url, {
proxyUrl,
headers: {
// A realistic desktop UA lowers the chance of immediate blocks.
'user-agent':
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
'accept-language': 'en-US,en;q=0.9',
'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
'cache-control': 'no-cache',
'pragma': 'no-cache'
},
timeoutMs: config?.http?.timeoutMs ?? 20000,
maxRetries: config?.http?.maxRetries ?? 3,
backoffMs: config?.http?.retryBackoffMs ?? 1000,
logger
});

const html = await res.text();
return { html, status: res.status };
}
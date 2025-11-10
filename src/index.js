import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline as streamPipeline } from 'stream';
import { promisify } from 'util';
import pino from 'pino';

import fetchProfile from './pipeline/fetch-profile.js';
import parseProfile from './pipeline/parse-profile.js';
import fetchRecentPosts from './pipeline/fetch-recent-posts.js';
import normalizeRecord from './pipeline/normalize-record.js';
import { RateLimiter } from './utils/rate-limit.js';

const pipelineAsync = promisify(streamPipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple promise pool to cap concurrency
async function promisePool(items, limit, worker) {
const ret = [];
const executing = new Set();
for (const item of items) {
const p = Promise.resolve().then(() => worker(item));
ret.push(p);
executing.add(p);
const clean = () => executing.delete(p);
p.then(clean, clean);
if (executing.size >= limit) {
await Promise.race(executing);
}
}
return Promise.all(ret);
}

export async function runScraper({
usernames,
outPath,
format = 'jsonl',
config,
proxyUrl = null,
recentPostsLimit = 12,
concurrency = 5,
logger = pino({ level: process.env.LOG_LEVEL || 'info' })
}) {
if (!Array.isArray(usernames) || usernames.length === 0) {
throw new Error('usernames must be a non-empty array.');
}

const limiter = new RateLimiter(
config?.rateLimit?.minDelayMs ?? 1200,
config?.rateLimit?.jitterMs ?? 400
);

// Prepare output stream
await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
const outStream = fs.createWriteStream(outPath, { flags: 'w' });

let writeRecord;
if (format === 'jsonl') {
writeRecord = async (rec) => outStream.write(JSON.stringify(rec) + '\n');
} else if (format === 'csv') {
// lazy load stringify to avoid unnecessary import when jsonl
const { stringify } = await import('csv-stringify');
const columns = [
'username', 'fullName', 'isVerified', 'biography', 'websiteUrl', 'externalUrls',
'profilePicUrl', 'followersCount', 'followingCount', 'postsCount', 'category',
'location', 'scrapedAt', 'recentPosts'
];
const stringifier = stringify({ header: true, columns });
await pipelineAsync(stringifier, outStream);
writeRecord = async (rec) =>
stringifier.write({
...rec,
externalUrls: (rec.externalUrls || []).join(';'),
recentPosts: JSON.stringify(rec.recentPosts || [])
});
} else {
throw new Error(`Unsupported format: ${format}`);
}

let processed = 0;
const start = Date.now();

await promisePool(usernames, concurrency, async (username) => {
try {
await limiter.wait();
logger.info({ username }, 'Fetching profile HTML');
const { html, status } = await fetchProfile({ username, proxyUrl, logger, config });
if (!html || status >= 400) {
logger.warn({ username, status }, 'Failed to fetch profile HTML');
return;
}

const parsed = await parseProfile({ username, html, logger });
logger.debug({ username, parsedKeys: Object.keys(parsed) }, 'Parsed profile');

// Fetch/parse recent posts (from HTML JSON if available; else fallback parsing)
const recentPosts = await fetchRecentPosts({
username,
html,
parsedJson: parsed._rawJson,
limit: recentPostsLimit,
logger
});

const record = normalizeRecord({ username, parsed, recentPosts, logger });
await writeRecord(record);
processed += 1;
logger.info({ username }, 'Done');
} catch (err) {
logger.error({ err: err?.message, stack: err?.stack, username }, 'Error processing username');
}
});

outStream.end();

const dur = Math.round((Date.now() - start) / 1000);
logger.info({ processed, durationSec: dur, outPath }, 'Scrape complete');
}
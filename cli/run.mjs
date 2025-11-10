import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import pino from 'pino';

import { runScraper } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
const argv = minimist(process.argv.slice(2), {
string: ['input', 'out', 'format', 'proxy', 'log-level'],
alias: {
i: 'input',
o: 'out',
f: 'format',
p: 'proxy'
},
default: {
input: path.join(__dirname, '..', 'data', 'inputs.sample.json'),
out: path.join(__dirname, '..', 'output', 'profiles.jsonl'),
format: 'jsonl'
}
});

const logger = pino({ level: argv['log-level'] || process.env.LOG_LEVEL || 'info' });
const defaultsPath = path.join(__dirname, '..', 'src', 'config', 'defaults.json');
const config = JSON.parse(await fs.promises.readFile(defaultsPath, 'utf8'));

// Load usernames
let usernames = [];
try {
const inputRaw = JSON.parse(await fs.promises.readFile(argv.input, 'utf8'));
if (Array.isArray(inputRaw)) {
usernames = inputRaw;
} else if (Array.isArray(inputRaw.usernames)) {
usernames = inputRaw.usernames;
} else {
throw new Error('Input JSON should be an array of usernames or an object with "usernames" array');
}
} catch (err) {
logger.error({ err: err?.message }, 'Failed to read input file');
process.exit(1);
}

const outExt = path.extname(argv.out).toLowerCase();
const format = argv.format || (outExt === '.csv' ? 'csv' : 'jsonl');
const recent = Number(process.env.RECENT_LIMIT || config.recentPostsLimit || 12);
const concurrency = Number(process.env.CONCURRENCY || config.concurrency || 5);

logger.info(
{ input: argv.input, out: argv.out, format, proxy: argv.proxy || null, recent, concurrency },
'Starting Instagram Full Profile Scraper'
);

await runScraper({
usernames,
outPath: argv.out,
format,
proxyUrl: argv.proxy || null,
recentPostsLimit: recent,
concurrency,
config,
logger
});
}

main().catch((err) => {
console.error(err);
process.exit(1);
});
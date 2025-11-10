export class RateLimiter {
constructor(minDelayMs = 1200, jitterMs = 400) {
this.minDelayMs = minDelayMs;
this.jitterMs = jitterMs;
this._last = 0;
}

async wait() {
const now = Date.now();
const delta = now - this._last;
const target = this.minDelayMs + Math.floor(Math.random() * this.jitterMs);
if (delta < target) {
await sleep(target - delta);
}
this._last = Date.now();
}
}

function sleep(ms) {
return new Promise((r) => setTimeout(r, ms));
}
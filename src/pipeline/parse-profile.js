import * as cheerio from 'cheerio';

/**
* Attempts to parse Instagram profile data from the HTML.
* It looks for several JSON locations to remain resilient across UI changes:
*  - __NEXT_DATA__ script (current Next.js payload)
*  - application/ld+json metadata
*  - legacy window._sharedData patterns
*/
export default async function parseProfile({ username, html, logger }) {
const $ = cheerio.load(html);
const result = {
username,
fullName: null,
isVerified: null,
biography: null,
websiteUrl: null,
externalUrls: [],
profilePicUrl: null,
followersCount: null,
followingCount: null,
postsCount: null,
category: null,
location: null,
_rawJson: null
};

// Helper to safely pull ints
const toInt = (v) => {
const n = Number(String(v).replace(/[^\d]/g, ''));
return Number.isFinite(n) ? n : null;
};

// 1) Try __NEXT_DATA__
let jsonPayload = null;
const nextData = $('script#__NEXT_DATA__').first().html();
if (nextData) {
try {
jsonPayload = JSON.parse(nextData);
} catch {
/* ignore */
}
}

// 2) Try application/ld+json blocks
if (!jsonPayload) {
$('script[type="application/ld+json"]').each((_, el) => {
try {
const raw = $(el).contents().text();
const parsed = JSON.parse(raw);
// Choose the first object that looks like a Person/Organization with name/url
if (parsed && (parsed['@type'] === 'Person' || parsed['@type'] === 'Organization')) {
jsonPayload = parsed;
return false;
}
} catch {
/* ignore */
}
});
}

// 3) Try legacy window._sharedData
if (!jsonPayload) {
const legacy = $('script')
.map((_, el) => $(el).html() || '')
.get()
.find((t) => t.includes('window._sharedData'));
if (legacy) {
try {
const jsonText = legacy.split('window._sharedData =')[1].split(';</script>')[0].trim();
jsonPayload = JSON.parse(jsonText);
} catch {
/* ignore */
}
}
}

// Attempt to traverse known shapes for profile data
const tryExtractFromNextData = (data) => {
// Newer IG profile payloads under props.pageProps... (subject to change)
const user =
data?.props?.pageProps?.user ??
data?.props?.pageProps?.graphql?.user ??
null;

if (!user) return false;

result.fullName = user.full_name ?? result.fullName;
result.isVerified = user.is_verified ?? result.isVerified;
result.biography = user.biography ?? result.biography;
result.websiteUrl = user.external_url ?? result.websiteUrl;
result.externalUrls =
user?.bio_links?.map((l) => l?.url) ??
user?.external_url_linkshimmed ?? // sometimes it's a single string
result.externalUrls;
if (typeof result.externalUrls === 'string') result.externalUrls = [result.externalUrls];
result.profilePicUrl = user.profile_pic_url_hd ?? user.profile_pic_url ?? result.profilePicUrl;
result.followersCount = toInt(user.edge_followed_by?.count ?? user.follower_count);
result.followingCount = toInt(user.edge_follow?.count ?? user.following_count);
result.postsCount = toInt(user.edge_owner_to_timeline_media?.count ?? user.media_count);
result.category = user.category_name ?? user.category ?? result.category;
result.location = user.location ?? result.location;

// Stash the original JSON for post parsing
result._rawJson = data;
return true;
};

const tryExtractFromLd = (data) => {
if (!data || typeof data !== 'object') return false;
result.fullName = data.name ?? result.fullName;
result.websiteUrl = data.url ?? result.websiteUrl;
result.profilePicUrl = data.image ?? result.profilePicUrl;
// ld+json doesn't usually include counts, but leave as-is if absent
result._rawJson = data;
return true;
};

let extracted = false;
if (jsonPayload) {
extracted = tryExtractFromNextData(jsonPayload) || tryExtractFromLd(jsonPayload);
}

// Fallbacks using meta tags
if (!result.fullName) {
const ogTitle = $('meta[property="og:title"]').attr('content') || '';
// Often "Name (@username) • Instagram photos and videos"
result.fullName = ogTitle.split('(@')[0].trim() || null;
}
if (!result.profilePicUrl) {
result.profilePicUrl =
$('meta[property="og:image"]').attr('content') ||
$('meta[name="twitter:image"]').attr('content') ||
result.profilePicUrl;
}

// If nothing extracted, keep graceful degradation
if (!extracted) {
// Attempt naive count extraction from visible text (best-effort)
const bodyText = $('body').text();
const followersMatch = bodyText.match(/([\d,.]+)\s+followers/i);
const followingMatch = bodyText.match(/([\d,.]+)\s+following/i);
const postsMatch = bodyText.match(/([\d,.]+)\s+posts/i);
result.followersCount = result.followersCount ?? (followersMatch ? toInt(followersMatch[1]) : null);
result.followingCount = result.followingCount ?? (followingMatch ? toInt(followingMatch[1]) : null);
result.postsCount = result.postsCount ?? (postsMatch ? toInt(postsMatch[1]) : null);
}

return result;
}
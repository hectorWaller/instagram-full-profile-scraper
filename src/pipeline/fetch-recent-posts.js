import * as cheerio from 'cheerio';

/**
* Attempts to extract recent posts from either the Next.js JSON payload or from HTML anchors.
*/
export default async function fetchRecentPosts({ username, html, parsedJson, limit = 12, logger }) {
let posts = [];

const pushPost = (p) => {
if (!p) return;
const safe = {
id: String(p.id ?? p.pk ?? p.media_id ?? ''),
shortcode: p.shortcode ?? p.code ?? '',
takenAt: isoFromEpoch(p.taken_at ?? p.takenAt ?? p.timestamp),
likesCount: toInt(p.edge_media_preview_like?.count ?? p.like_count ?? p.likes),
commentsCount: toInt(p.edge_media_to_comment?.count ?? p.comment_count ?? p.comments),
caption: truncate((p.edge_media_to_caption?.edges?.[0]?.node?.text ?? p.caption?.text ?? p.caption) || '', 220),
mediaUrl:
p.display_url ??
p.display_url_hd ??
p.image_versions2?.candidates?.[0]?.url ??
p.thumbnail_src ??
p.media_url ??
'',
mediaType: resolveType(p.__typename ?? p.media_type),
permalink:
(p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : p.permalink) ??
''
};
if (safe.id || safe.shortcode || safe.permalink) posts.push(safe);
};

// 1) From Next.js style JSON payloads
const candidates = [
export default function normalizeRecord({ username, parsed, recentPosts, logger }) {
  const nowIso = new Date().toISOString();

  return {
    username,
    fullName: parsed.fullName ?? null,
    isVerified: parsed.isVerified ?? null,
    biography: parsed.biography ?? null,
    websiteUrl: parsed.websiteUrl ?? null,
    externalUrls: Array.isArray(parsed.externalUrls) ? parsed.externalUrls.filter(Boolean) : [],
    profilePicUrl: parsed.profilePicUrl ?? null,
    followersCount: parsed.followersCount ?? null,
    followingCount: parsed.followingCount ?? null,
    postsCount: parsed.postsCount ?? null,
    category: parsed.category ?? null,
    location: parsed.location ?? null,
    scrapedAt: nowIso,
    recentPosts: (recentPosts || []).map((p) => ({
      id: p.id || '',
      shortcode: p.shortcode || '',
      takenAt: p.takenAt || null,
      likesCount: numberOrNull(p.likesCount),
      commentsCount: numberOrNull(p.commentsCount),
      caption: p.caption || '',
      mediaUrl: p.mediaUrl || '',
      mediaType: p.mediaType || 'IMAGE',
      permalink: p.permalink || (p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : '')
    }))
  };
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
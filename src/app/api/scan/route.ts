import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformResult {
  platform: string;
  icon: string;
  handle: string;
  profileUrl?: string;
  status: 'verified' | 'probable' | 'likely' | 'possible' | 'not_found';
  confidence: number;
  realData: boolean;
  metadata?: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function headProbe(url: string, timeoutMs = 6000): Promise<number> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaTrace/2.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.status;
  } catch {
    return 0;
  }
}

async function getProbe(url: string, timeoutMs = 6000): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaTrace/2.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch {
    return { status: 0, text: '' };
  }
}

// ─── Platform Checkers ────────────────────────────────────────────────────────

// 1. GitHub — public JSON API
async function checkGitHub(username: string): Promise<PlatformResult | null> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'PersonaTrace/2.0' };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 404) return { platform: 'GitHub', icon: '💻', handle: username, status: 'not_found', confidence: 100, realData: true };
    if (!res.ok) return null;

    const d = await res.json();
    return {
      platform: 'GitHub', icon: '💻',
      handle: d.login ?? username,
      profileUrl: d.html_url,
      status: 'verified', confidence: 100, realData: true,
      metadata: {
        name: d.name ?? '',
        bio: (d.bio ?? '').slice(0, 80),
        followers: String(d.followers ?? 0),
        repos: String(d.public_repos ?? 0),
        joined: d.created_at ? new Date(d.created_at).getFullYear().toString() : '',
        location: d.location ?? '',
        company: d.company ?? '',
        avatar: d.avatar_url ?? '',
      },
    };
  } catch { return null; }
}

// 2. Reddit — public JSON API
async function checkReddit(username: string): Promise<PlatformResult | null> {
  try {
    const clean = username.replace(/^(u\/|@)/, '');
    const res = await fetch(`https://www.reddit.com/user/${encodeURIComponent(clean)}/about.json`, {
      headers: { 'User-Agent': 'PersonaTrace/2.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 404) return { platform: 'Reddit', icon: '🟠', handle: 'u/' + clean, status: 'not_found', confidence: 100, realData: true };
    if (!res.ok) return null;

    const json = await res.json();
    const d = json?.data;
    if (!d) return null;

    return {
      platform: 'Reddit', icon: '🟠',
      handle: 'u/' + (d.name ?? clean),
      profileUrl: `https://reddit.com/user/${d.name ?? clean}`,
      status: 'verified', confidence: 100, realData: true,
      metadata: {
        karma: String((d.link_karma ?? 0) + (d.comment_karma ?? 0)),
        joined: d.created_utc ? new Date(d.created_utc * 1000).getFullYear().toString() : '',
        verified: d.verified ? 'Yes' : 'No',
        moderator: d.is_mod ? 'Yes' : 'No',
      },
    };
  } catch { return null; }
}

// 3. npm — public CouchDB API
async function checkNPM(username: string): Promise<PlatformResult | null> {
  try {
    const clean = username.replace(/^@/, '');
    const res = await fetch(`https://registry.npmjs.org/-/user/org.couchdb.user:${encodeURIComponent(clean)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status !== 200) return null;
    return { platform: 'npm', icon: '📦', handle: clean, profileUrl: `https://www.npmjs.com/~${clean}`, status: 'verified', confidence: 99, realData: true };
  } catch { return null; }
}

// 4. HackerNews — Algolia public API
async function checkHackerNews(username: string): Promise<PlatformResult | null> {
  try {
    const res = await fetch(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d) return { platform: 'HackerNews', icon: '🔶', handle: username, status: 'not_found', confidence: 100, realData: true };
    return {
      platform: 'HackerNews', icon: '🔶',
      handle: d.id ?? username,
      profileUrl: `https://news.ycombinator.com/user?id=${d.id ?? username}`,
      status: 'verified', confidence: 100, realData: true,
      metadata: {
        karma: String(d.karma ?? 0),
        joined: d.created ? new Date(d.created * 1000).getFullYear().toString() : '',
        about: (d.about ?? '').replace(/<[^>]*>/g, '').slice(0, 80),
      },
    };
  } catch { return null; }
}

// 5. PyPI — public JSON API
async function checkPyPI(username: string): Promise<PlatformResult | null> {
  try {
    const { status } = await getProbe(`https://pypi.org/user/${encodeURIComponent(username)}/`, 5000);
    if (status === 200) return { platform: 'PyPI', icon: '🐍', handle: username, profileUrl: `https://pypi.org/user/${username}/`, status: 'verified', confidence: 98, realData: true };
    if (status === 404) return { platform: 'PyPI', icon: '🐍', handle: username, status: 'not_found', confidence: 100, realData: true };
    return null;
  } catch { return null; }
}

// 6. Dev.to — public API
async function checkDevTo(username: string): Promise<PlatformResult | null> {
  try {
    const res = await fetch(`https://dev.to/api/users/by_username?url=${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'PersonaTrace/2.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return { platform: 'Dev.to', icon: '👨‍💻', handle: username, status: 'not_found', confidence: 100, realData: true };
    if (!res.ok) return null;
    const d = await res.json();
    return {
      platform: 'Dev.to', icon: '👨‍💻',
      handle: d.username ?? username,
      profileUrl: `https://dev.to/${d.username ?? username}`,
      status: 'verified', confidence: 100, realData: true,
      metadata: {
        name: d.name ?? '',
        followers: String(d.followers_count ?? 0),
        posts: String(d.articles_count ?? 0),
        joined: d.joined_at ? new Date(d.joined_at).getFullYear().toString() : '',
      },
    };
  } catch { return null; }
}

// 7. Keybase — public API
async function checkKeybase(username: string): Promise<PlatformResult | null> {
  try {
    const res = await fetch(`https://keybase.io/_/api/1.0/user/lookup.json?usernames=${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const user = d?.them?.[0];
    if (!user) return { platform: 'Keybase', icon: '🔑', handle: username, status: 'not_found', confidence: 100, realData: true };
    return {
      platform: 'Keybase', icon: '🔑',
      handle: user.basics?.username ?? username,
      profileUrl: `https://keybase.io/${user.basics?.username ?? username}`,
      status: 'verified', confidence: 100, realData: true,
      metadata: {
        fullname: user.profile?.full_name ?? '',
        bio: (user.profile?.bio ?? '').slice(0, 80),
        location: user.profile?.location ?? '',
      },
    };
  } catch { return null; }
}

// 8–20. HTTP probe-based platforms (HEAD/GET + soft-404 detection)

interface ProbeConfig {
  platform: string;
  icon: string;
  url: (u: string) => string;
  handlePrefix?: string;
  notFoundIndicators?: string[]; // body substrings that mean "user not found" even on 200
}

const PROBE_PLATFORMS: ProbeConfig[] = [
  {
    platform: 'Medium',
    icon: '✍️',
    url: (u) => `https://medium.com/@${u}`,
    notFoundIndicators: ['Page not found', 'Hmm, that page doesn'],
  },
  {
    platform: 'Pinterest',
    icon: '📌',
    url: (u) => `https://www.pinterest.com/${u}/`,
    notFoundIndicators: ['Sorry! We couldn', 'This page isn', 'page not found'],
  },
  {
    platform: 'SoundCloud',
    icon: '🎵',
    url: (u) => `https://soundcloud.com/${u}`,
    notFoundIndicators: ['We can\'t find that user', '404'],
  },
  {
    platform: 'Twitch',
    icon: '🎮',
    url: (u) => `https://www.twitch.tv/${u}`,
    notFoundIndicators: ['Sorry. Unless you', 'page not found'],
  },
  {
    platform: 'Spotify',
    icon: '🎧',
    url: (u) => `https://open.spotify.com/user/${u}`,
    notFoundIndicators: ['doesn\'t exist', 'Page not found'],
  },
  {
    platform: 'Vimeo',
    icon: '🎬',
    url: (u) => `https://vimeo.com/${u}`,
    notFoundIndicators: ['Sorry, we couldn\'t find that page'],
  },
  {
    platform: 'Behance',
    icon: '🎨',
    url: (u) => `https://www.behance.net/${u}`,
    notFoundIndicators: ['This page doesn\'t exist', '404'],
  },
  {
    platform: 'Flickr',
    icon: '📷',
    url: (u) => `https://www.flickr.com/people/${u}/`,
    notFoundIndicators: ['Page Not Found', 'not a valid'],
  },
  {
    platform: 'Linktree',
    icon: '🌳',
    url: (u) => `https://linktr.ee/${u}`,
    notFoundIndicators: ['Sorry, this page isn\'t available', 'page not found'],
  },
  {
    platform: 'ProductHunt',
    icon: '🚀',
    url: (u) => `https://www.producthunt.com/@${u}`,
    notFoundIndicators: ['Oops! This page doesn\'t exist', '404'],
  },
  {
    platform: 'About.me',
    icon: '👤',
    url: (u) => `https://about.me/${u}`,
    notFoundIndicators: ['Page Not Found', 'doesn\'t exist'],
  },
  {
    platform: 'Steam',
    icon: '🎯',
    url: (u) => `https://steamcommunity.com/id/${u}`,
    notFoundIndicators: ['The specified profile could not be found', 'No user found'],
  },
  {
    platform: 'Mastodon',
    icon: '🐘',
    url: (u) => `https://mastodon.social/@${u}`,
    notFoundIndicators: ['The page you\'re looking for isn\'t here', 'not found'],
  },
];

async function checkProbePlatform(
  config: ProbeConfig,
  username: string
): Promise<PlatformResult | null> {
  try {
    const url = config.url(username);
    const { status, text } = await getProbe(url, 7000);

    if (status === 0) return null; // timeout or network error

    if (status === 404) {
      return {
        platform: config.platform,
        icon: config.icon,
        handle: (config.handlePrefix ?? '') + username,
        status: 'not_found',
        confidence: 100,
        realData: true,
      };
    }

    if (status === 200) {
      // Check for soft-404 (page exists but shows "user not found" message)
      const lower = text.toLowerCase();
      const isSoft404 = config.notFoundIndicators?.some((indicator) =>
        lower.includes(indicator.toLowerCase())
      );

      if (isSoft404) {
        return {
          platform: config.platform,
          icon: config.icon,
          handle: (config.handlePrefix ?? '') + username,
          status: 'not_found',
          confidence: 100,
          realData: true,
        };
      }

      return {
        platform: config.platform,
        icon: config.icon,
        handle: (config.handlePrefix ?? '') + username,
        profileUrl: url,
        status: 'verified',
        confidence: 100,
        realData: true,
      };
    }

    // 403/429/5xx — platform is blocking but user may exist
    if (status === 403 || status === 429) {
      return {
        platform: config.platform,
        icon: config.icon,
        handle: (config.handlePrefix ?? '') + username,
        profileUrl: url,
        status: 'probable',
        confidence: 72,
        realData: true,
        metadata: { note: 'Rate-limited — manual verification recommended' },
      };
    }

    return null;
  } catch { return null; }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targets = [], mode = 'username' } = body as { targets: string[]; mode: string };

    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: 'No targets provided' }, { status: 400 });
    }

    if (mode !== 'username') {
      return NextResponse.json({ platforms: [], mode, targets });
    }

    const username = targets[0].replace(/^@/, '').trim();
    if (!username) return NextResponse.json({ platforms: [], mode, targets });

    // Fire all platform checks in parallel
    const checks: Promise<PlatformResult | null>[] = [
      checkGitHub(username),
      checkReddit(username),
      checkNPM(username),
      checkHackerNews(username),
      checkPyPI(username),
      checkDevTo(username),
      checkKeybase(username),
      ...PROBE_PLATFORMS.map((cfg) => checkProbePlatform(cfg, username)),
    ];

    // Also check any additional targets (up to 2 more)
    for (const extra of targets.slice(1, 3)) {
      const u = extra.replace(/^@/, '').trim();
      if (u && u !== username) {
        checks.push(checkGitHub(u), checkReddit(u));
      }
    }

    const results = await Promise.allSettled(checks);
    const platforms: PlatformResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        platforms.push(result.value);
      }
    }

    return NextResponse.json({ platforms, mode, targets });
  } catch (err) {
    console.error('[/api/scan]', err);
    return NextResponse.json({ platforms: [], error: 'Internal error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

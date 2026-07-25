import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformResult {
  platform: string;
  icon: string;
  handle: string;
  profileUrl?: string;
  status: 'verified' | 'not_found';
  confidence: number;
  realData: true; // all results here are from real APIs
  metadata?: Record<string, string>;
}

// ─── 1. GitHub — public JSON API ──────────────────────────────────────────────
// Returns actual 404 for missing users. 100% reliable.

async function checkGitHub(username: string): Promise<PlatformResult | null> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'PersonaTrace/2.0' };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 404) {
      return { platform: 'GitHub', icon: '💻', handle: username, status: 'not_found', confidence: 100, realData: true };
    }
    if (res.status === 403 || res.status === 429) {
      // Rate limited — skip rather than guess
      return null;
    }
    if (!res.ok) return null;

    const d = await res.json();
    return {
      platform: 'GitHub', icon: '💻',
      handle: d.login ?? username,
      profileUrl: d.html_url,
      status: 'verified', confidence: 100, realData: true,
      metadata: {
        name: d.name ?? '',
        bio: (d.bio ?? '').slice(0, 100),
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

// ─── 2. Reddit — public JSON API ──────────────────────────────────────────────
// Returns 404 JSON for missing users. 100% reliable.

async function checkReddit(username: string): Promise<PlatformResult | null> {
  try {
    const clean = username.replace(/^(u\/|@)/, '');
    const res = await fetch(
      `https://www.reddit.com/user/${encodeURIComponent(clean)}/about.json`,
      {
        headers: { 'User-Agent': 'PersonaTrace/2.0' },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (res.status === 404) {
      return { platform: 'Reddit', icon: '🟠', handle: 'u/' + clean, status: 'not_found', confidence: 100, realData: true };
    }
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

// ─── 3. HackerNews — Firebase public API ──────────────────────────────────────
// Returns null JSON for missing users. 100% reliable.

async function checkHackerNews(username: string): Promise<PlatformResult | null> {
  try {
    const res = await fetch(
      `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const d = await res.json();

    if (!d) {
      // Firebase returns literal null for missing users
      return { platform: 'HackerNews', icon: '🔶', handle: username, status: 'not_found', confidence: 100, realData: true };
    }

    return {
      platform: 'HackerNews', icon: '🔶',
      handle: d.id ?? username,
      profileUrl: `https://news.ycombinator.com/user?id=${d.id ?? username}`,
      status: 'verified', confidence: 100, realData: true,
      metadata: {
        karma: String(d.karma ?? 0),
        joined: d.created ? new Date(d.created * 1000).getFullYear().toString() : '',
      },
    };
  } catch { return null; }
}

// ─── 4. Dev.to — public JSON API ──────────────────────────────────────────────
// Returns 404 JSON for missing users. Reliable.

async function checkDevTo(username: string): Promise<PlatformResult | null> {
  try {
    const res = await fetch(`https://dev.to/api/users/by_username?url=${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'PersonaTrace/2.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      return { platform: 'Dev.to', icon: '👨‍💻', handle: username, status: 'not_found', confidence: 100, realData: true };
    }
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
      },
    };
  } catch { return null; }
}

// ─── 5. npm — public CouchDB API ──────────────────────────────────────────────

async function checkNPM(username: string): Promise<PlatformResult | null> {
  try {
    const clean = username.replace(/^@/, '');
    const res = await fetch(
      `https://registry.npmjs.org/-/user/org.couchdb.user:${encodeURIComponent(clean)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.status === 404) {
      return { platform: 'npm', icon: '📦', handle: clean, status: 'not_found', confidence: 100, realData: true };
    }
    if (!res.ok) return null;
    return {
      platform: 'npm', icon: '📦',
      handle: clean,
      profileUrl: `https://www.npmjs.com/~${clean}`,
      status: 'verified', confidence: 100, realData: true,
    };
  } catch { return null; }
}

// ─── 6. Keybase — public API ──────────────────────────────────────────────────

async function checkKeybase(username: string): Promise<PlatformResult | null> {
  try {
    const res = await fetch(
      `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${encodeURIComponent(username)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const user = d?.them?.[0];

    if (!user) {
      return { platform: 'Keybase', icon: '🔑', handle: username, status: 'not_found', confidence: 100, realData: true };
    }

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

    // Run all real API checks in parallel
    const checks = [
      checkGitHub(username),
      checkReddit(username),
      checkHackerNews(username),
      checkDevTo(username),
      checkNPM(username),
      checkKeybase(username),
    ];

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

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

// ─── GitHub check (public API, 60 req/hr unauthenticated) ─────────────────────

async function checkGitHub(username: string): Promise<PlatformResult | null> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'PersonaTrace/1.0' };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 404) {
      return {
        platform: 'GitHub',
        icon: '💻',
        handle: username,
        status: 'not_found',
        confidence: 100,
        realData: true,
      };
    }

    if (!res.ok) return null;

    const data = await res.json();
    return {
      platform: 'GitHub',
      icon: '💻',
      handle: data.login ?? username,
      profileUrl: data.html_url,
      status: 'verified',
      confidence: 100,
      realData: true,
      metadata: {
        name: data.name ?? '',
        bio: data.bio ?? '',
        followers: String(data.followers ?? 0),
        repos: String(data.public_repos ?? 0),
        joined: data.created_at ? new Date(data.created_at).getFullYear().toString() : '',
        location: data.location ?? '',
        company: data.company ?? '',
        blog: data.blog ?? '',
        avatar: data.avatar_url ?? '',
      },
    };
  } catch {
    return null;
  }
}

// ─── Reddit check (public JSON API, no auth) ──────────────────────────────────

async function checkReddit(username: string): Promise<PlatformResult | null> {
  try {
    const clean = username.replace(/^(u\/|@)/, '');
    const res = await fetch(
      `https://www.reddit.com/user/${encodeURIComponent(clean)}/about.json`,
      {
        headers: { 'User-Agent': 'PersonaTrace/1.0' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (res.status === 404) {
      return {
        platform: 'Reddit',
        icon: '👽',
        handle: 'u/' + clean,
        status: 'not_found',
        confidence: 100,
        realData: true,
      };
    }

    if (!res.ok) return null;

    const json = await res.json();
    const d = json?.data;
    if (!d) return null;

    const karma = (d.link_karma ?? 0) + (d.comment_karma ?? 0);
    const created = d.created_utc ? new Date(d.created_utc * 1000).getFullYear() : '';

    return {
      platform: 'Reddit',
      icon: '👽',
      handle: 'u/' + (d.name ?? clean),
      profileUrl: `https://reddit.com/user/${d.name ?? clean}`,
      status: 'verified',
      confidence: 100,
      realData: true,
      metadata: {
        karma: String(karma),
        joined: String(created),
        verified: d.verified ? 'Yes' : 'No',
        goldMember: d.is_gold ? 'Yes' : 'No',
        moderator: d.is_mod ? 'Yes' : 'No',
      },
    };
  } catch {
    return null;
  }
}

// ─── NPM check ────────────────────────────────────────────────────────────────

async function checkNPM(username: string): Promise<PlatformResult | null> {
  try {
    const clean = username.replace(/^@/, '');
    const res = await fetch(`https://registry.npmjs.org/-/user/org.couchdb.user:${encodeURIComponent(clean)}`, {
      signal: AbortSignal.timeout(4000),
    });

    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) return null;

    return {
      platform: 'npm',
      icon: '📦',
      handle: clean,
      profileUrl: `https://www.npmjs.com/~${clean}`,
      status: 'verified',
      confidence: 97,
      realData: true,
    };
  } catch {
    return null;
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targets = [], mode = 'username' } = body as { targets: string[]; mode: string };

    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: 'No targets provided' }, { status: 400 });
    }

    const platforms: PlatformResult[] = [];

    if (mode === 'username') {
      // Check up to 3 targets in parallel
      const checks = targets.slice(0, 3).flatMap((rawTarget) => {
        const username = rawTarget.replace(/^@/, '').trim();
        if (!username) return [];
        return [checkGitHub(username), checkReddit(username), checkNPM(username)];
      });

      const results = await Promise.allSettled(checks);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          platforms.push(result.value);
        }
      }
    }

    return NextResponse.json({ platforms, mode, targets });
  } catch (err) {
    console.error('[/api/scan]', err);
    return NextResponse.json({ platforms: [], error: 'Internal error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

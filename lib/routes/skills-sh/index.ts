import { escape } from 'entities';
import type { Context } from 'hono';
import MarkdownIt from 'markdown-it';
import pMap from 'p-map';

import ConfigNotFoundError from '@/errors/types/config-not-found';
import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';

const apiUrl = 'https://skills.sh/api/v1/skills';
const siteUrl = 'https://skills.sh';
const supportedViews = new Set(['all-time', 'trending', 'hot']);

type LeaderboardView = 'all-time' | 'trending' | 'hot';

type Skill = {
    id: string;
    name: string;
    source: string;
    installs: number;
    sourceType: string;
    installUrl: string | null;
    url: string;
    installsYesterday?: number;
    change?: number;
};

type SkillsResponse = {
    data: Skill[];
    generatedAt?: string;
};

type SkillDetail = {
    files: Array<{ path: string; contents: string }> | null;
    installs?: number;
    hash?: string | null;
};

const markdown = new MarkdownIt({ html: false, linkify: true });

export const route: Route = {
    path: '/:view?',
    categories: ['programming'],
    example: '/skills-sh/trending',
    parameters: {
        view: '`all-time`（总安装量）、`trending`（24 小时趋势，默认）或 `hot`（当前小时相较昨天同一小时的变化）',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Leaderboard',
    maintainers: ['ljh12138164'],
    handler,
    description: 'skills.sh Agent Skills 热门榜单。该路由需要部署在已启用 OIDC Federation 的 Vercel 项目中。',
};

export async function handler(ctx: Context, includeDetails = false): Promise<Data> {
    const view = parseView(ctx.req.param('view'));
    const token = ctx.req.header('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;

    if (!token) {
        throw new ConfigNotFoundError('Vercel OIDC token is unavailable. Enable OIDC Federation for this Vercel project.');
    }

    const response = await ofetch<SkillsResponse>(apiUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        query: {
            view,
            page: 0,
            per_page: 100,
        },
    });

    if (!response || !Array.isArray(response.data)) {
        throw new Error('skills.sh leaderboard response is invalid');
    }

    const items = await pMap(
        response.data,
        async (skill, index) => {
            let description: string | null = null;
            let detail: SkillDetail | null = null;
            try {
                if (includeDetails) {
                    detail = await getDetail(skill, token);
                    const file = detail.files?.find((file) => file.path === 'SKILL.md');
                    description = file ? parseDescription(file.contents) : null;
                } else {
                    description = await getDescription(skill, token);
                }
            } catch {
                // Keep the leaderboard available when an individual skill has no detail snapshot.
            }
            const item = toDataItem(skill, index, view, description);
            if (!includeDetails) {
                return item;
            }
            const raw = detail?.files?.find((file) => file.path === 'SKILL.md')?.contents;
            const contents = raw && new TextEncoder().encode(raw).length <= 128 * 1024 ? raw : undefined;
            const body = contents?.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/, '');
            return {
                ...item,
                description: body ? markdown.render(body) : '',
                summary: description ?? undefined,
                content: contents ? { text: contents } : undefined,
                _extra: {
                    skills: {
                        version: 1,
                        source: skill.source,
                        sourceType: skill.sourceType,
                        installUrl: skill.installUrl,
                        installs: skill.installs,
                        totalInstalls: detail?.installs ?? (view === 'all-time' ? skill.installs : undefined),
                        hash: detail?.hash,
                        state: contents ? 'ready' : raw ? 'oversize' : detail ? 'missing' : 'error',
                    },
                },
            };
        },
        { concurrency: 5 }
    );
    let bytes = 0;
    return {
        title: `skills.sh ${view === 'all-time' ? 'All Time' : view === 'hot' ? 'Hot' : 'Trending'} Skills`,
        link: view === 'all-time' ? siteUrl : `${siteUrl}/${view}`,
        description: view === 'all-time' ? 'Skills ranked by total installs.' : view === 'hot' ? 'Skills gaining installs compared with the same hour yesterday.' : 'Skills with the most install growth over the last 24 hours.',
        lastBuildDate: response.generatedAt,
        item: includeDetails
            ? items.map((item) => {
                  const size = new TextEncoder().encode(JSON.stringify(item)).length;
                  if (bytes + size <= 4_000_000) {
                      bytes += size;
                      return item;
                  }
                  return { ...item, description: '', content: undefined, _extra: { ...item._extra, skills: { ...item._extra?.skills, state: 'oversize' } } };
              })
            : items,
    };
}

export function parseView(value = 'trending'): LeaderboardView {
    if (!supportedViews.has(value)) {
        throw new InvalidParameterError('Invalid view. Supported values are "all-time", "trending", and "hot".');
    }
    return value as LeaderboardView;
}

export function toDataItem(skill: Skill, index: number, view: LeaderboardView, description?: string | null): DataItem {
    const metadata = [
        ...(description ? [`<p>${escape(description)}</p>`] : []),
        `<p><strong>Rank:</strong> ${index + 1}</p>`,
        `<p><strong>Installs:</strong> ${skill.installs.toLocaleString('en-US')}</p>`,
        `<p><strong>Source:</strong> ${escape(skill.source)}</p>`,
        `<p><strong>Source type:</strong> ${escape(skill.sourceType)}</p>`,
    ];

    if (view === 'hot' && typeof skill.change === 'number') {
        metadata.push(`<p><strong>Hourly change:</strong> ${skill.change >= 0 ? '+' : ''}${skill.change.toLocaleString('en-US')}</p>`);
    }
    if (view === 'hot' && typeof skill.installsYesterday === 'number') {
        metadata.push(`<p><strong>Same hour yesterday:</strong> ${skill.installsYesterday.toLocaleString('en-US')}</p>`);
    }
    if (skill.installUrl) {
        metadata.push(`<p><a href="${escape(skill.installUrl)}">Source repository</a></p>`);
    }

    return {
        title: `#${index + 1} ${skill.name}`,
        link: skill.url,
        guid: skill.id,
        author: skill.source.split('/', 1)[0],
        category: [skill.sourceType],
        description: metadata.join(''),
    };
}

function getDetail(skill: Skill, token: string): Promise<SkillDetail> {
    return cache.tryGet(
        `skills-sh:detail:v1:${skill.id}`,
        async () =>
            await ofetch<SkillDetail>(`${apiUrl}/${skill.id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
    );
}

function getDescription(skill: Skill, token: string): Promise<string | null> {
    return cache.tryGet(`skills-sh:description:${skill.id}`, async () => {
        const detail = await getDetail(skill, token);
        const file = detail.files?.find((entry) => entry.path === 'SKILL.md');
        return file ? parseDescription(file.contents) : null;
    });
}

export function parseDescription(contents: string): string | null {
    const frontmatter = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    if (!frontmatter) {
        return null;
    }

    const lines = frontmatter.split(/\r?\n/);
    const descriptionIndex = lines.findIndex((line) => line.startsWith('description:'));
    if (descriptionIndex === -1) {
        return null;
    }

    const value = lines[descriptionIndex].slice('description:'.length).trim();
    if (['>', '>-', '|', '|-'].includes(value)) {
        const blockLines: string[] = [];
        const followingLines = lines.slice(descriptionIndex + 1);
        for (const line of followingLines) {
            if (!line.startsWith(' ') && !line.startsWith('\t')) {
                break;
            }
            if (line.trim()) {
                blockLines.push(line.trim());
            }
        }
        if (!blockLines.length) {
            return null;
        }
        return value.startsWith('>') ? blockLines.join(' ') : blockLines.join('\n');
    }

    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    return (quoted ? value.slice(1, -1) : value) || null;
}

import type { Context } from 'hono';

import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

import { BASE_URL, unpackTurboStream, USER_AGENT } from './utils';

const VALID_CATEGORIES = new Set(['overall', 'coding', 'reasoning', 'professional', 'knowledge']);

const CATEGORY_NAMES: Record<string, string> = {
    overall: '综合',
    coding: '编程',
    reasoning: '科研',
    professional: '专业办公',
    knowledge: '知识问答',
};

interface ModelData {
    model: {
        slug: string;
        name: string;
        provider: string;
        releasedAt?: string;
        brand?: {
            src?: string;
            monogram?: string;
        };
        contextWindowTokens?: number;
    };
    price?: {
        currency?: string;
        input?: number;
        output?: number;
        cached?: number;
        inputCny?: number;
        outputCny?: number;
        cachedCny?: number;
        officialUrl?: string;
        note?: string;
    } | null;
    access?: {
        domestic?: boolean;
        weightsUrl?: string | null;
    };
}

interface BoardEntry {
    slug: string;
    rank: number;
    score: number;
    sourceCount?: number;
    coverage?: number;
}

interface LeaderboardPayload {
    run: {
        id: string;
        methodologyVersion: string;
        generatedAt: string;
        fx?: {
            rate: number;
            asOf: string;
            sourceName: string;
        };
    };
    models: Record<string, ModelData>;
    boards: Array<{
        board: {
            key: string;
            name: string;
            title: string;
            description?: string;
        };
        entries: BoardEntry[];
    }>;
}

export const route: Route = {
    path: '/leaderboard/:category?',
    categories: ['programming'],
    example: '/aihot/leaderboard',
    parameters: {
        category: '榜单类别，可选: overall(综合榜, 默认), coding(编程榜), reasoning(科研榜), professional(专业办公榜), knowledge(知识问答榜)',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '大模型排行榜',
    maintainers: ['ljh12138164'],
    handler,
    url: 'aihot.news/leaderboard',
    description: 'AIHOT 大模型排行榜：只用第三方评测机构统一实测成绩，涵盖编程、科研、专业办公、知识问答与真人盲选加权评分，展示名次、分项成绩与 API 参考价格。',
};

async function handler(ctx: Context): Promise<Data> {
    const category = ctx.req.param('category') || 'overall';
    if (!VALID_CATEGORIES.has(category)) {
        throw new InvalidParameterError(`不支持的榜单类别: ${category}。可选类别: ${[...VALID_CATEGORIES].join(', ')}`);
    }

    const limit = Math.trunc(Number(ctx.req.query('limit') || '30'));
    const filter = ctx.req.query('filter') || 'all'; // all, domestic, open

    const payload = await cache.tryGet(
        'aihot:leaderboard:boards',
        async () => {
            const html = await ofetch(`${BASE_URL}/leaderboard`, {
                headers: {
                    'User-Agent': USER_AGENT,
                },
                responseType: 'text',
            });
            return unpackTurboStream<LeaderboardPayload>(html, 'leaderboard-boards');
        },
        3600 * 4
    );

    const targetBoard = payload.boards.find((b) => b.board?.key === category);
    if (!targetBoard) {
        throw new Error(`未找到指定榜单数据: ${category}`);
    }

    let entries = targetBoard.entries;

    if (filter === 'domestic') {
        entries = entries.filter((e) => payload.models[e.slug]?.access?.domestic);
    } else if (filter === 'open') {
        entries = entries.filter((e) => payload.models[e.slug]?.access?.weightsUrl);
    }

    if (limit > 0) {
        entries = entries.slice(0, limit);
    }

    const boardName = CATEGORY_NAMES[category];
    const categoryPath = category === 'overall' ? '/leaderboard' : `/leaderboard/category/${category}`;

    const items: DataItem[] = entries.map((entry) => {
        const modelEntry = payload.models[entry.slug];
        const model = modelEntry?.model ?? { slug: entry.slug, name: entry.slug, provider: '未知' };
        const price = modelEntry?.price;
        const access = modelEntry?.access;

        const scoreStr = typeof entry.score === 'number' ? entry.score.toFixed(1) : String(entry.score);
        const title = `[No.${entry.rank} 评分: ${scoreStr}] ${model.name} · ${model.provider}`;

        const priceParts: string[] = [];
        if (price) {
            if (price.cachedCny !== null && price.cachedCny !== undefined) {
                priceParts.push(`缓存: ¥${price.cachedCny}`);
            }
            if (price.inputCny !== null && price.inputCny !== undefined) {
                priceParts.push(`输入: ¥${price.inputCny}`);
            }
            if (price.outputCny !== null && price.outputCny !== undefined) {
                priceParts.push(`输出: ¥${price.outputCny}`);
            }
        }
        const priceSummary = priceParts.length > 0 ? priceParts.join(' / ') + ' (每百万 Token)' : '暂无官方按量价格';

        const coveragePercent = typeof entry.coverage === 'number' ? `${(entry.coverage * 100).toFixed(0)}%` : '未知';
        const sourceCountStr = entry.sourceCount ? `${entry.sourceCount} 项评测` : '';

        // Extract sub-scores for the 5 categories from payload.boards
        const subScores: string[] = [];
        for (const [k, name] of Object.entries(CATEGORY_NAMES)) {
            if (k === 'overall') {
                continue;
            }
            const b = payload.boards.find((board) => board.board?.key === k);
            const m = b?.entries.find((item) => item.slug === entry.slug);
            if (m) {
                subScores.push(`${name}：${m.score.toFixed(1)}分 (第${m.rank}名)`);
            }
        }
        const subScoresHtml = subScores.length > 0 ? `<p style="margin: 8px 0;"><strong>五大领域分项分：</strong><br/>${subScores.join(' · ')}</p>` : '';

        const description = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; font-size: 14px; color: #333;">
  <p style="margin: 0 0 8px 0;">
    <strong>榜单名次：</strong>第 ${entry.rank} 名<br/>
    <strong>AIHOT 评分：</strong><span style="font-size: 16px; font-weight: bold; color: #2563eb;">${scoreStr}</span><br/>
    <strong>模型全称：</strong>${model.name}<br/>
    <strong>开发机构：</strong>${model.provider}<br/>
    <strong>上线日期：</strong>${model.releasedAt || '未知'}<br/>
    <strong>评测覆盖：</strong>${[sourceCountStr, `覆盖率 ${coveragePercent}`].filter(Boolean).join(' · ')}
  </p>

  ${subScoresHtml}

  <p style="margin: 8px 0;">
    <strong>API 参考价格：</strong>${priceSummary}<br/>
    ${price?.officialUrl ? `<a href="${price.officialUrl}" target="_blank" rel="noopener noreferrer">查看官方定价说明 ↗</a><br/>` : ''}
    ${price?.note ? `<small style="color: #666;">注：${price.note}</small><br/>` : ''}
  </p>

  ${access?.weightsUrl ? `<p style="margin: 8px 0;"><strong>开源权重：</strong><a href="${access.weightsUrl}" target="_blank" rel="noopener noreferrer">Hugging Face 仓库 ↗</a></p>` : ''}
  
  <p style="margin: 8px 0 0 0; font-size: 12px; color: #888;">
    评分方法：${payload.run?.methodologyVersion || 'IRT 模型评分'} · 计算批次：${payload.run?.generatedAt ? new Date(payload.run.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '最新'}
  </p>
</div>
        `.trim();

        const categories = [`${boardName}榜`, model.provider, access?.domestic ? '国产模型' : '海外模型', access?.weightsUrl ? '开源模型' : '商业闭源'];

        return {
            title,
            link: `${BASE_URL}/leaderboard/${model.slug}`,
            guid: `aihot:leaderboard:${category}:${model.slug}:${entry.rank}`,
            author: model.provider,
            pubDate: parseDate(model.releasedAt || payload.run?.generatedAt || new Date()),
            description,
            category: categories,
        };
    });

    return {
        title: `AIHOT 大模型${boardName}排行榜`,
        link: `${BASE_URL}${categoryPath}`,
        description: targetBoard.board?.description || `AIHOT ${boardName}榜：只用第三方统一实测成绩，综合评估各维度能力与官方参考价格。`,
        item: items,
        language: 'zh-CN',
    };
}

export { handler };

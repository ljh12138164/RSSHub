import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

import { BASE_URL, unpackTurboStream, USER_AGENT } from './utils';

interface BenchmarkRow {
    sourceRank: number;
    sourceModelName: string;
    provider: string;
    display: string;
    configurationLabel?: string;
    modelSlug?: string;
    excluded?: string | null;
}

interface BenchmarkDetailPayload {
    source: {
        key: string;
        name: string;
        operator: string;
        fullName?: string;
        area?: string;
        description?: string;
        officialUrl?: string;
        what?: string;
        usage?: string;
        attribution?: string;
    };
    rows: BenchmarkRow[];
    run?: {
        generatedAt?: string;
        methodologyVersion?: string;
    };
}

export const route: Route = {
    path: '/source/:sourceKey',
    categories: ['programming'],
    example: '/aihot/source/vals-terminal-bench-4',
    parameters: {
        sourceKey: '单项评测唯一标识，如 vals-terminal-bench-4, livebench-coding, artificial-analysis-frontiercode-2, arena-text',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '单项评测专项排行榜',
    maintainers: ['ljh12138164'],
    handler,
    url: 'aihot.news/leaderboard/sources',
    description: '查看指定 Benchmark 下所有大模型的单独实测名次与成绩（如 Terminal-Bench 4.0、FrontierCode 2.0、LiveBench、Arena Text 等）。',
};

async function handler(ctx: Context): Promise<Data> {
    const sourceKey = ctx.req.param('sourceKey');
    if (!sourceKey) {
        throw new Error('必须提供评测 sourceKey 参数');
    }

    const { source, rows, run } = await cache.tryGet(
        `aihot:leaderboard:source:${sourceKey}`,
        async () => {
            const html = await ofetch(`${BASE_URL}/leaderboard/sources/${sourceKey}`, {
                headers: {
                    'User-Agent': USER_AGENT,
                },
                responseType: 'text',
            });
            return unpackTurboStream<BenchmarkDetailPayload>(html, 'leaderboard-source');
        },
        3600 * 4
    );
    const sourceLink = `${BASE_URL}/leaderboard/sources/${sourceKey}`;
    const pubDate = parseDate(run?.generatedAt || new Date().toISOString());

    const items: DataItem[] = (rows || []).map((row) => {
        const title = `[No.${row.sourceRank} 得分: ${row.display}] ${row.sourceModelName} (${row.provider})`;
        const modelLink = row.modelSlug ? `${BASE_URL}/leaderboard/${row.modelSlug}` : sourceLink;

        const description = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; font-size: 14px;">
  <p style="margin: 0 0 8px 0;">
    <strong>专项名次：</strong>第 ${row.sourceRank} 名<br/>
    <strong>实测成绩：</strong><span style="font-size: 16px; font-weight: bold; color: #2563eb;">${row.display}</span><br/>
    <strong>参评模型：</strong>${row.sourceModelName}<br/>
    <strong>所属厂商：</strong>${row.provider}<br/>
    <strong>测试配置：</strong>${row.configurationLabel || '默认配置'}<br/>
    <strong>评测项目：</strong>${source.fullName || source.name} (${source.operator})<br/>
    ${source.officialUrl ? `<a href="${source.officialUrl}" target="_blank" rel="noopener noreferrer">查看官方 Benchmark 主页 ↗</a>` : ''}
  </p>
  ${row.excluded ? `<p style="color: #dc2626;"><small>注：${row.excluded}</small></p>` : ''}
</div>
        `.trim();

        return {
            title,
            link: modelLink,
            guid: `aihot:source:${sourceKey}:${row.modelSlug || row.sourceModelName}:${row.sourceRank}`,
            author: row.provider,
            pubDate,
            description,
            category: [source.area || '专项评测', row.provider, source.operator],
        };
    });

    return {
        title: `${source.name} (${source.operator}) - AIHOT 单项评测排行榜`,
        link: sourceLink,
        description: `${source.fullName || source.name}：${source.description || ''}。测试方法：${source.what || ''}`,
        item: items,
        language: 'zh-CN',
    };
}

export { handler };

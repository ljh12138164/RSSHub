import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

import { BASE_URL, unpackTurboStream, USER_AGENT } from './utils';

interface BenchmarkEvidenceItem {
    sourceKey: string;
    name: string;
    operator: string;
    display: string;
    reading?: number;
    sourceRank?: number;
    configurationLabel?: string;
    officialUrl?: string;
    upstreamAt?: string;
}

interface CategoryEvidenceGroup {
    key: string;
    name: string;
    score: number;
    items: BenchmarkEvidenceItem[];
}

interface ModelDetailPayload {
    model: {
        slug: string;
        name: string;
        provider: string;
        releasedAt?: string;
        contextWindowTokens?: number;
        weightsUrl?: string | null;
    };
    overall?: {
        rank?: number;
        score?: number;
        coverage?: number;
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
    categories?: Array<{
        key: string;
        name: string;
        rank?: number;
        score?: number;
        coverage?: number;
        sourceCount?: number;
    }>;
    evidence?: CategoryEvidenceGroup[];
    unmeasured?: Array<{
        key: string;
        name: string;
        operator?: string;
    }>;
    run?: {
        id: string;
        methodologyVersion: string;
        generatedAt: string;
    };
}

export const route: Route = {
    path: '/model/:slug',
    categories: ['programming'],
    example: '/aihot/model/gemini-4-carbon',
    parameters: {
        slug: '模型唯一标识 (slug)，如 gemini-4-carbon, claude-opus-5-5, deepseek-v-4-1-flash-1017',
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '模型详细评测成绩与证据链',
    maintainers: ['ljh12138164'],
    handler,
    url: 'aihot.news/leaderboard',
    description: '获取指定大模型的全项实测成绩明细：包含编程、科研、专业办公、知识问答、真人盲选的单项实测得分、折算分、推理配置与官方评测链接。',
};

async function handler(ctx: Context): Promise<Data> {
    const slug = ctx.req.param('slug');
    if (!slug) {
        throw new Error('必须提供模型 slug 参数');
    }

    const { model, overall, price, categories, evidence, unmeasured, run } = await cache.tryGet(
        `aihot:leaderboard:model:${slug}`,
        async () => {
            const html = await ofetch(`${BASE_URL}/leaderboard/${slug}`, {
                headers: {
                    'User-Agent': USER_AGENT,
                },
                responseType: 'text',
            });
            return unpackTurboStream<ModelDetailPayload>(html, 'leaderboard-model');
        },
        3600 * 4
    );
    const modelLink = `${BASE_URL}/leaderboard/${slug}`;
    const overallScoreStr = overall?.score === undefined ? '暂无评分' : overall.score.toFixed(1);
    const rankStr = overall?.rank ? `第 ${overall.rank} 名` : '暂未排榜';

    const items: DataItem[] = [];

    // 1. Overview summary item
    const subScoresList = (categories || [])
        .map(
            (c) =>
                `<li><strong>${c.name}：</strong>${c.score === undefined ? '-' : c.score.toFixed(1)}分${c.rank ? ` (第${c.rank}名)` : ''} · 测了 ${c.sourceCount ?? '-'} 项 (覆盖率 ${c.coverage ? (c.coverage * 100).toFixed(0) : '-'}%)</li>`
        )
        .join('');

    const priceText = price ? `缓存: ¥${price.cachedCny ?? '-'} / 输入: ¥${price.inputCny ?? '-'} / 输出: ¥${price.outputCny ?? '-'} (人民币/百万Token)` : '暂无官方按量价';

    const overviewHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; font-size: 14px;">
  <h2>${model.name} 综合评测总览</h2>
  <p>
    <strong>综合评分：</strong><span style="font-size: 18px; font-weight: bold; color: #2563eb;">${overallScoreStr}</span> (${rankStr})<br/>
    <strong>开发机构：</strong>${model.provider}<br/>
    <strong>上线日期：</strong>${model.releasedAt || '未知'}<br/>
    <strong>API 定价：</strong>${priceText}<br/>
    ${price?.officialUrl ? `<a href="${price.officialUrl}" target="_blank" rel="noopener noreferrer">查看官方定价说明 ↗</a><br/>` : ''}
    ${model.weightsUrl ? `<strong>开源权重：</strong><a href="${model.weightsUrl}" target="_blank" rel="noopener noreferrer">Hugging Face 仓库 ↗</a><br/>` : ''}
  </p>
  <h3>五大领域分项分：</h3>
  <ul>${subScoresList}</ul>
</div>
    `.trim();

    items.push({
        title: `【总览】${model.name} 综合评分 ${overallScoreStr} (${rankStr})`,
        link: modelLink,
        guid: `aihot:model:${slug}:overview`,
        author: model.provider,
        pubDate: parseDate(model.releasedAt || run?.generatedAt || new Date()),
        description: overviewHtml,
        category: ['总览', model.provider],
    });

    // 2. Evidence items for each domain (编程、科研、专业办公、知识问答、真人盲选)
    const evidenceGroups = evidence || [];
    for (const group of evidenceGroups) {
        const rowsHtml = group.items
            .map(
                (b) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px 12px; font-weight: 600;">
        ${b.officialUrl ? `<a href="${b.officialUrl}" target="_blank" rel="noopener noreferrer">${b.name}</a>` : b.name}
        <br/><small style="color: #666; font-weight: normal;">${b.operator}</small>
      </td>
      <td style="padding: 8px 12px; color: #0284c7; font-weight: 600;">${b.display}</td>
      <td style="padding: 8px 12px; color: #16a34a; font-weight: 600;">${b.reading === undefined ? '-' : b.reading.toFixed(1)}</td>
      <td style="padding: 8px 12px;">${b.sourceRank ? `第 ${b.sourceRank} 名` : '-'}</td>
      <td style="padding: 8px 12px; color: #555;"><small>${b.configurationLabel || '默认配置'}</small></td>
    </tr>
        `
            )
            .join('');

        const groupDescription = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; font-size: 14px;">
  <h3>${group.name}领域评测成绩（得分：${group.score.toFixed(1)} 分 · 共 ${group.items.length} 项实测）</h3>
  <table style="width: 100%; border-collapse: collapse; text-align: left; margin: 12px 0;">
    <thead>
      <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        <th style="padding: 8px 12px;">评测项目 (机构)</th>
        <th style="padding: 8px 12px;">实测原始成绩</th>
        <th style="padding: 8px 12px;">折算能力分</th>
        <th style="padding: 8px 12px;">单项名次</th>
        <th style="padding: 8px 12px;">测试运行配置</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</div>
        `.trim();

        items.push({
            title: `【${group.name}】${model.name} 领域得分: ${group.score.toFixed(1)} 分 (${group.items.length}项实测)`,
            link: modelLink,
            guid: `aihot:model:${slug}:${group.key}`,
            author: model.provider,
            pubDate: parseDate(model.releasedAt || run?.generatedAt || new Date()),
            description: groupDescription,
            category: [group.name, model.provider],
        });
    }

    // 3. Unmeasured items (if any)
    if (unmeasured && unmeasured.length > 0) {
        const unmeasuredList = unmeasured.map((u) => `<li>${u.name}${u.operator ? ` (${u.operator})` : ''}</li>`).join('');
        items.push({
            title: `【待测项】${model.name} 尚未取得成绩的评测 (${unmeasured.length}项)`,
            link: modelLink,
            guid: `aihot:model:${slug}:unmeasured`,
            author: model.provider,
            pubDate: parseDate(model.releasedAt || run?.generatedAt || new Date()),
            description: `<div style="font-family: sans-serif;"><h3>尚未取得有效成绩的公开评测项（${unmeasured.length}项）：</h3><ul>${unmeasuredList}</ul></div>`,
            category: ['待测项', model.provider],
        });
    }

    return {
        title: `${model.name} (${model.provider}) - AIHOT 详细评测成绩与证据链`,
        link: modelLink,
        description: `${model.name} 在 AIHOT 中的完整多维度第三方评测原始成绩、折算能力分与官方证据链。`,
        item: items,
        language: 'zh-CN',
    };
}

export { handler };

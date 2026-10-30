import { beforeEach, describe, expect, it, vi } from 'vitest';

import InvalidParameterError from '../lib/errors/types/invalid-parameter';
import { handler as leaderboardHandler } from '../lib/routes/aihot/leaderboard';
import { handler as modelHandler } from '../lib/routes/aihot/model';
import { handler as sourceHandler } from '../lib/routes/aihot/source';
import { unpackTurboStream } from '../lib/routes/aihot/utils';
import cache from '../lib/utils/cache';

vi.mock('../lib/utils/cache', () => ({
    default: {
        tryGet: vi.fn((_key, fetchValue) => fetchValue()),
    },
}));
vi.mock('../lib/utils/ofetch', () => ({
    default: vi.fn(),
}));

const mockLeaderboardPayload = {
    run: {
        id: 'test-run-123',
        methodologyVersion: '2026.10-capability-scale-v21',
        generatedAt: '2026-10-30T00:00:00.000Z',
    },
    models: {
        'gemini-4-carbon': {
            model: {
                slug: 'gemini-4-carbon',
                name: 'Gemini 4 Carbon',
                provider: 'Google',
                releasedAt: '2026-10-28',
            },
            price: null,
            access: {
                domestic: false,
                weightsUrl: null,
            },
        },
        'claude-opus-5-5': {
            model: {
                slug: 'claude-opus-5-5',
                name: 'Claude Opus 5.5',
                provider: 'Anthropic',
                releasedAt: '2026-09-22',
            },
            price: {
                currency: 'USD',
                inputCny: 26.65,
                outputCny: 133.23,
                cachedCny: 1.33,
                officialUrl: 'https://anthropic.com/pricing',
            },
            access: {
                domestic: false,
                weightsUrl: null,
            },
        },
        'deepseek-v4': {
            model: {
                slug: 'deepseek-v4',
                name: 'DeepSeek V4',
                provider: 'DeepSeek',
                releasedAt: '2026-10-15',
            },
            price: {
                currency: 'CNY',
                inputCny: 1,
                outputCny: 4,
                cachedCny: 0.02,
            },
            access: {
                domestic: true,
                weightsUrl: 'https://huggingface.co/deepseek-ai/DeepSeek-V4',
            },
        },
    },
    boards: [
        {
            board: {
                key: 'overall',
                name: '综合',
                title: 'AIHOT 大模型综合榜',
                description: '综合评测排行榜',
            },
            entries: [
                { slug: 'gemini-4-carbon', rank: 1, score: 75.2, sourceCount: 17, coverage: 0.47 },
                { slug: 'claude-opus-5-5', rank: 2, score: 73, sourceCount: 38, coverage: 0.97 },
                { slug: 'deepseek-v4', rank: 3, score: 71, sourceCount: 25, coverage: 0.75 },
            ],
        },
        {
            board: {
                key: 'coding',
                name: '编程',
                title: 'AIHOT 大模型编程榜',
            },
            entries: [
                { slug: 'claude-opus-5-5', rank: 1, score: 73.9, sourceCount: 10, coverage: 0.89 },
                { slug: 'deepseek-v4', rank: 2, score: 70, sourceCount: 8, coverage: 0.7 },
            ],
        },
    ],
};

const mockModelPayload = {
    model: {
        slug: 'gemini-4-carbon',
        name: 'Gemini 4 Carbon',
        provider: 'Google',
        releasedAt: '2026-10-28',
    },
    overall: {
        rank: 1,
        score: 75.2,
        coverage: 0.47,
    },
    price: null,
    categories: [
        { key: 'coding', name: '编程', score: 73.1, rank: 2, sourceCount: 5, coverage: 0.44 },
        { key: 'reasoning', name: '科研', score: 76.6, rank: 1, sourceCount: 4, coverage: 0.5 },
    ],
    evidence: [
        {
            key: 'coding',
            name: '编程',
            score: 73.1,
            items: [
                {
                    sourceKey: 'vals-terminal-bench-4',
                    name: 'Terminal-Bench 4.0',
                    operator: 'Vals AI',
                    display: '63.1%',
                    reading: 76.5,
                    sourceRank: 4,
                    configurationLabel: 'High 推理',
                    officialUrl: 'https://www.vals.ai/benchmarks/terminal-bench-4',
                },
            ],
        },
    ],
    unmeasured: [{ key: 'livebench-coding', name: 'LiveBench 编程', operator: 'LiveBench' }],
};

const mockSourcePayload = {
    source: {
        key: 'vals-terminal-bench-4',
        name: 'Terminal-Bench 4.0 · Vals',
        operator: 'Vals AI',
        fullName: 'Terminal-Bench 4.0（Vals AI 复跑）',
        area: '编程',
        description: '在命令行环境里独立完成一整件工程任务。',
        officialUrl: 'https://www.vals.ai/benchmarks/terminal-bench-4',
    },
    rows: [
        {
            sourceRank: 1,
            sourceModelName: 'anthropic/claude-opus-5-5',
            provider: 'Anthropic',
            display: '65.2%',
            configurationLabel: 'Max 推理',
            modelSlug: 'claude-opus-5-5',
        },
        {
            sourceRank: 2,
            sourceModelName: 'anthropic/claude-sonnet-5-5',
            provider: 'Anthropic',
            display: '64.1%',
            configurationLabel: 'Max 推理',
            modelSlug: 'claude-sonnet-5-5',
        },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AIHOT Leaderboard Routes', () => {
    it('throws InvalidParameterError on unsupported category', async () => {
        const ctx = {
            req: {
                param: vi.fn().mockReturnValue('invalid_cat'),
                query: vi.fn().mockReturnValue(undefined),
            },
        } as never;

        await expect(leaderboardHandler(ctx)).rejects.toThrow(InvalidParameterError);
    });

    it('returns overall leaderboard with formatted items and sub-scores', async () => {
        vi.mocked(cache.tryGet).mockResolvedValueOnce(mockLeaderboardPayload);

        const ctx = {
            req: {
                param: vi.fn().mockReturnValue('overall'),
                query: vi.fn().mockReturnValue(undefined),
            },
        } as never;

        const result = await leaderboardHandler(ctx);

        expect(result.title).toBe('AIHOT 大模型综合排行榜');
        expect(result.link).toBe('https://aihot.news/leaderboard');
        expect(result.item).toHaveLength(3);

        const item0 = result.item![0];
        expect(item0.title).toBe('[No.1 评分: 75.2] Gemini 4 Carbon · Google');
        expect(item0.link).toBe('https://aihot.news/leaderboard/gemini-4-carbon');
        expect(item0.author).toBe('Google');
        expect(item0.category).toContain('综合榜');
        expect(item0.description).toContain('榜单名次：</strong>第 1 名');

        const item1 = result.item![1];
        expect(item1.title).toBe('[No.2 评分: 73.0] Claude Opus 5.5 · Anthropic');
        expect(item1.description).toContain('¥26.65');
        expect(item1.description).toContain('五大领域分项分');
    });

    it('returns model detail breakdown and evidence', async () => {
        vi.mocked(cache.tryGet).mockResolvedValueOnce(mockModelPayload);

        const ctx = {
            req: {
                param: vi.fn((key: string) => (key === 'slug' ? 'gemini-4-carbon' : undefined)),
            },
        } as never;

        const result = await modelHandler(ctx);

        expect(result.title).toContain('Gemini 4 Carbon');
        expect(result.link).toBe('https://aihot.news/leaderboard/gemini-4-carbon');
        expect(result.item).toHaveLength(3); // Overview + 1 domain group + Unmeasured

        const overview = result.item![0];
        expect(overview.title).toContain('【总览】');
        expect(overview.description).toContain('编程：</strong>73.1分');

        const coding = result.item![1];
        expect(coding.title).toContain('【编程】');
        expect(coding.description).toContain('Terminal-Bench 4.0');
        expect(coding.description).toContain('63.1%');
        expect(coding.description).toContain('76.5');
    });

    it('returns single benchmark leaderboard rows', async () => {
        vi.mocked(cache.tryGet).mockResolvedValueOnce(mockSourcePayload);

        const ctx = {
            req: {
                param: vi.fn((key: string) => (key === 'sourceKey' ? 'vals-terminal-bench-4' : undefined)),
            },
        } as never;

        const result = await sourceHandler(ctx);

        expect(result.title).toContain('Terminal-Bench 4.0');
        expect(result.link).toBe('https://aihot.news/leaderboard/sources/vals-terminal-bench-4');
        expect(result.item).toHaveLength(2);

        const row0 = result.item![0];
        expect(row0.title).toBe('[No.1 得分: 65.2%] anthropic/claude-opus-5-5 (Anthropic)');
        expect(row0.description).toContain('实测成绩：</strong><span style="font-size: 16px; font-weight: bold; color: #2563eb;">65.2%</span>');
        expect(row0.description).toContain('Max 推理');
    });

    it('unpacks TurboStream payload properly', () => {
        const mockStreamData = JSON.stringify([{ _1: 2 }, 'loaderData', { _3: 4 }, 'my-test-key', { _5: 6 }, 'hello', 'world']);
        const html = `<html><head><script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(mockStreamData)});</script></head><body></body></html>`;

        const unpacked = unpackTurboStream(html, 'my-test-key');
        expect(unpacked).toEqual({ hello: 'world' });
    });
});

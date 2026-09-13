import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handler, parseDescription, parseView, toDataItem } from '../lib/routes/skills-sh';
import cache from '../lib/utils/cache';
import ofetch from '../lib/utils/ofetch';

vi.mock('../lib/utils/cache', () => ({ default: { tryGet: vi.fn((_key, fetchValue) => fetchValue()) } }));
vi.mock('../lib/utils/ofetch', () => ({ default: vi.fn() }));

const skill = {
    id: 'vercel-labs/skills/find-skills',
    name: 'find-skills',
    source: 'vercel-labs/skills',
    installs: 24531,
    sourceType: 'github',
    installUrl: 'https://github.com/vercel-labs/skills',
    url: 'https://skills.sh/vercel-labs/skills/find-skills',
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('skills.sh leaderboard route', () => {
    it('defaults to trending and rejects unsupported views', () => {
        expect(parseView()).toBe('trending');
        expect(parseView('hot')).toBe('hot');
        expect(() => parseView('all-time')).toThrow('Supported values are');
    });

    it('maps stable leaderboard metadata without inventing a publication date', () => {
        expect(toDataItem({ ...skill, installsYesterday: 10, change: 5 }, 0, 'hot', 'Find useful agent skills.')).toMatchObject({
            title: '#1 find-skills',
            link: skill.url,
            guid: skill.id,
            author: 'vercel-labs',
            category: ['github'],
            description: expect.stringContaining('<p>Find useful agent skills.</p>'),
        });
        expect(toDataItem(skill, 0, 'trending').pubDate).toBeUndefined();
    });

    it('extracts plain, quoted, and folded frontmatter descriptions', () => {
        expect(parseDescription('---\nname: demo\ndescription: Plain description.\n---\n')).toBe('Plain description.');
        expect(parseDescription('---\nname: demo\ndescription: "Quoted description."\n---\n')).toBe('Quoted description.');
        expect(parseDescription('---\nname: demo\ndescription: >\n  First line\n  second line.\n---\n')).toBe('First line second line.');
    });

    it('forwards the request-scoped Vercel token to the official API', async () => {
        vi.mocked(ofetch)
            .mockResolvedValueOnce({ data: [skill], generatedAt: '2026-09-13T00:00:00.000Z' })
            .mockResolvedValueOnce({ files: [{ path: 'SKILL.md', contents: '---\nname: find-skills\ndescription: Discover useful skills.\n---\n' }] });

        const result = await handler({
            req: {
                param: vi.fn().mockReturnValue('hot'),
                header: vi.fn().mockReturnValue('oidc-token'),
            },
        } as never);

        expect(ofetch).toHaveBeenNthCalledWith(1, 'https://skills.sh/api/v1/skills', {
            headers: { Authorization: 'Bearer oidc-token' },
            query: { view: 'hot', page: 0, per_page: 100 },
        });
        expect(cache.tryGet).toHaveBeenCalledWith('skills-sh:description:vercel-labs/skills/find-skills', expect.any(Function));
        expect(ofetch).toHaveBeenNthCalledWith(2, 'https://skills.sh/api/v1/skills/vercel-labs/skills/find-skills', {
            headers: { Authorization: 'Bearer oidc-token' },
        });
        expect(result).toMatchObject({
            title: 'skills.sh Hot Skills',
            link: 'https://skills.sh/hot',
            lastBuildDate: '2026-09-13T00:00:00.000Z',
            item: [{ guid: skill.id, description: expect.stringContaining('Discover useful skills.') }],
        });
    });

    it('fails clearly when no Vercel OIDC token is available', async () => {
        const previousToken = process.env.VERCEL_OIDC_TOKEN;
        delete process.env.VERCEL_OIDC_TOKEN;

        await expect(
            handler({
                req: {
                    param: vi.fn().mockReturnValue('trending'),
                    header: vi.fn().mockReturnValue(undefined),
                },
            } as never)
        ).rejects.toThrow('Enable OIDC Federation');

        if (previousToken === undefined) {
            delete process.env.VERCEL_OIDC_TOKEN;
        } else {
            process.env.VERCEL_OIDC_TOKEN = previousToken;
        }
    });
});

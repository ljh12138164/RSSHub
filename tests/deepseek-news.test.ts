import { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { route } from '../lib/routes/deepseek/news';

const { fetchPage } = vi.hoisted(() => ({ fetchPage: vi.fn() }));

vi.mock('../lib/utils/ofetch', () => ({ default: fetchPage }));
vi.mock('../lib/utils/cache', () => ({ default: { tryGet: (_key: string, fetcher: () => unknown) => fetcher() } }));

describe('DeepSeek news route', () => {
    beforeEach(() => fetchPage.mockReset());

    it('reads sidebar articles with their original dates and bodies', async () => {
        fetchPage
            .mockResolvedValueOnce('<nav><a href="/zh-cn/news/news260821">News</a></nav>')
            .mockResolvedValueOnce(`
            <aside><ul>
                <li class="theme-doc-sidebar-item-link"><a href="/zh-cn/guides/thinking_mode">Guide</a></li>
                <li class="theme-doc-sidebar-item-link"><a href="/zh-cn/news/news260821">DeepSeek-V3.1 2026/08/21</a></li>
            </ul></aside>
        `)
            .mockResolvedValueOnce('<article class="theme-doc-markdown"><div><div><h1>DeepSeek-V3.1</h1><p>Article body</p></div></div></article>');

        const data = await route.handler(new Context());

        expect(data).toMatchObject({
            link: 'https://api-docs.deepseek.com/zh-cn/news/news260821',
            item: [{ title: 'DeepSeek-V3.1', link: 'https://api-docs.deepseek.com/zh-cn/news/news260821', pubDate: new Date('2026-08-21T00:00:00Z'), description: '<p>Article body</p>' }],
        });
        expect(fetchPage).toHaveBeenCalledTimes(3);
    });

    it('reports a missing news navigation link', async () => {
        fetchPage.mockResolvedValueOnce('<nav><a href="/zh-cn/guides/thinking_mode">Guide</a></nav>');

        await expect(route.handler(new Context())).rejects.toThrow('DeepSeek news navigation link was not found');
    });
});

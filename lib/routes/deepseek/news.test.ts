import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';

import { extractNewsLinks, findLatestNewsUrl } from './news';

describe('DeepSeek news route', () => {
    it('discovers the latest news page from the documentation landing page', () => {
        const $ = load(`
            <a href="/zh-cn/guides/thinking_mode">Guide</a>
            <a href="/zh-cn/news/news260821">DeepSeek-V3.1 2026/08/21</a>
        `);

        expect(findLatestNewsUrl($)).toBe('https://api-docs.deepseek.com/zh-cn/news/news260821');
    });

    it('keeps only unique news links from the expanded sidebar', () => {
        const $ = load(`
            <ul>
                <li class="theme-doc-sidebar-item-link"><a href="/zh-cn/guides/thinking_mode">Guide</a></li>
                <li class="theme-doc-sidebar-item-link"><a href="/zh-cn/news/news260821">DeepSeek-V3.1 2026/08/21</a></li>
                <li class="theme-doc-sidebar-item-link"><a href="/zh-cn/news/news251201">DeepSeek-V3.2 2025-12-01</a></li>
                <li class="theme-doc-sidebar-item-link"><a href="/zh-cn/news/news260821">Duplicate 2026/08/21</a></li>
            </ul>
        `);

        expect(extractNewsLinks($)).toEqual([
            {
                date: '2026/08/21',
                url: 'https://api-docs.deepseek.com/zh-cn/news/news260821',
            },
            {
                date: '2025-12-01',
                url: 'https://api-docs.deepseek.com/zh-cn/news/news251201',
            },
        ]);
    });
});

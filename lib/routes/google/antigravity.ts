import { load } from 'cheerio';
import pMap from 'p-map';
import Parser from 'rss-parser';

import type { Data, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://antigravity.google';
const parser = new Parser();

export const route: Route = {
    path: '/antigravity/blog',
    name: 'Antigravity Blog',
    url: 'antigravity.google/blog',
    example: '/google/antigravity/blog',
    categories: ['programming'],
    maintainers: ['ljh12138164'],
    description: 'Uses the official RSS feed for article metadata and fetches and caches full articles, including cover images and inline media.',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [{ source: ['antigravity.google/blog', 'antigravity.google/blog/:slug'], target: '/antigravity/blog' }],
    view: ViewType.Articles,
    handler,
};

async function handler(): Promise<Data> {
    const xml = await ofetch(`${baseUrl}/blog/rss.xml`, { responseType: 'text' });
    const feed = await parser.parseString(xml);

    return {
        title: feed.title!,
        description: feed.description,
        link: `${baseUrl}/blog`,
        language: feed.language,
        item: await pMap(
            feed.items,
            async (item) => ({
                title: item.title!,
                link: item.link,
                guid: item.guid,
                author: item.creator || item.author,
                pubDate: item.pubDate ? parseDate(item.pubDate) : undefined,
                category: item.categories,
                ...(await cache.tryGet(item.link!, () => fetchArticle(item.link!))),
            }),
            { concurrency: 3 }
        ),
    };
}

async function fetchArticle(link: string) {
    const html = await ofetch(link, { responseType: 'text' });
    const $ = load(html);
    const article = $('.post .content-section').first();
    if (!article.text().trim()) {
        throw new Error(`Antigravity Blog article content not found: ${link}`);
    }

    const content = $('<div>').append($('.post > .hero-image-wrapper').first(), article);
    content.find('script, style, button, .bottom-share-wrapper, .post-newsletter-wrapper, .button-container').remove();
    content.find('[data-src]').each((_, element) => {
        const node = $(element);
        node.attr('src', node.attr('src') || node.attr('data-src')!);
        node.removeAttr('data-src');
    });
    content.find('[srcset]').removeAttr('srcset');
    content.find('[src], [href], [poster]').each((_, element) => {
        const node = $(element);
        for (const attribute of ['src', 'href', 'poster']) {
            const value = node.attr(attribute);
            if (value) {
                node.attr(attribute, new URL(value, link).href);
            }
        }
    });

    const cover = $('meta[property="og:image"]').attr('content');
    return {
        description: content.html()!,
        image: cover ? new URL(cover, link).href : undefined,
    };
}

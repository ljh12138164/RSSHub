import type { CheerioAPI } from 'cheerio';
import { load } from 'cheerio';

import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const ROOT_URL = 'https://api-docs.deepseek.com/zh-cn';

const NEWS_PATH_PREFIX = '/zh-cn/news/news';
const NEWS_LINK_SELECTOR = 'li.theme-doc-sidebar-item-link a[href]';
const ARTICLE_CONTENT_SELECTOR = '.theme-doc-markdown > div > div';
const ARTICLE_TITLE_SELECTOR = ARTICLE_CONTENT_SELECTOR + ' > h1';

interface NewsLink {
    date?: string;
    url: string;
}

const fetchPageContent = async (url: string) => {
    const response = await ofetch(url);
    return load(response);
};

const extractArticleInfo = ($article: CheerioAPI) => {
    const contentElement = $article(ARTICLE_CONTENT_SELECTOR);
    const title = $article(ARTICLE_TITLE_SELECTOR).text();
    $article(ARTICLE_TITLE_SELECTOR).remove();
    const content = contentElement.html();
    return { title, content };
};

const toNewsUrl = (href: string | undefined): string | undefined => {
    if (!href) {
        return;
    }

    const url = new URL(href, ROOT_URL);
    return url.pathname.startsWith(NEWS_PATH_PREFIX) ? url.href : undefined;
};

export const findLatestNewsUrl = ($: CheerioAPI): string => {
    const url = $('a[href]')
        .toArray()
        .map((anchor) => toNewsUrl($(anchor).attr('href')))
        .find((candidate) => candidate !== undefined);

    if (!url) {
        throw new Error('DeepSeek documentation did not expose a news page link');
    }

    return url;
};

export const extractNewsLinks = ($: CheerioAPI): NewsLink[] => {
    const seen = new Set<string>();
    const links: NewsLink[] = [];

    for (const anchor of $(NEWS_LINK_SELECTOR).toArray()) {
        const $anchor = $(anchor);
        const url = toNewsUrl($anchor.attr('href'));
        if (!url || seen.has(url)) {
            continue;
        }

        seen.add(url);
        links.push({
            date: $anchor.text().match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)?.[0],
            url,
        });
    }

    if (links.length === 0) {
        throw new Error('DeepSeek news sidebar did not contain any news articles');
    }

    return links;
};

const createDataItem = ({ date, url }: NewsLink): Promise<DataItem> =>
    cache.tryGet(url, async () => {
        const $article = await fetchPageContent(url);
        const { title, content } = extractArticleInfo($article);

        return {
            title,
            link: url,
            ...(date && { pubDate: parseDate(date) }),
            description: content || undefined,
        };
    });

const handler = async (): Promise<Data> => {
    const $landing = await fetchPageContent(ROOT_URL);
    const latestNewsUrl = findLatestNewsUrl($landing);
    const $news = await fetchPageContent(latestNewsUrl);
    const items: DataItem[] = await Promise.all(extractNewsLinks($news).map((link) => createDataItem(link)));

    return {
        title: 'DeepSeek 新闻',
        link: latestNewsUrl,
        item: items,
    };
};

export const route: Route = {
    path: '/news',
    categories: ['programming'],
    example: '/deepseek/news',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['api-docs.deepseek.com'],
            target: '/news',
        },
    ],
    name: '新闻',
    maintainers: ['1837634311'],
    handler,
};

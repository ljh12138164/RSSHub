import { load } from 'cheerio';
import { decodeHTML } from 'entities';
import type { Context } from 'hono';
import pMap from 'p-map';
import Parser from 'rss-parser';

import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Data, Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import { parseScriptSource } from '@/utils/parse-js';

const baseUrl = 'https://antigravity.google';
const parser = new Parser();

export const route: Route = {
    path: '/antigravity/blog/:lang?',
    name: 'Antigravity Blog',
    url: 'antigravity.google/blog',
    example: '/google/antigravity/blog',
    categories: ['programming'],
    maintainers: ['ljh12138164'],
    description: 'Uses the official RSS feed for article metadata and fetches and caches full articles, including cover images and inline media. The zh-CN route uses official Chinese translations when available.',
    parameters: { lang: 'Language: en (default) or zh-CN.' },
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

async function handler(ctx: Context): Promise<Data> {
    const language = ctx.req.param('lang') || 'en';
    if (!['en', 'zh-CN'].includes(language)) {
        throw new InvalidParameterError('Supported Antigravity Blog languages: en, zh-CN');
    }
    const translations = language === 'zh-CN' ? await cache.tryGet(`${baseUrl}/blog:zh-CN`, fetchTranslations) : undefined;
    const xml = await ofetch(`${baseUrl}/blog/rss.xml`, { responseType: 'text' });
    const feed = await parser.parseString(xml);

    return {
        title: translations ? 'Google Antigravity 官方博客' : feed.title!,
        description: feed.description,
        link: `${baseUrl}/blog`,
        language: translations ? 'zh-CN' : feed.language,
        item: await pMap(
            feed.items,
            async (item) => ({
                title: translations?.[normalizeTranslationKey(item.title!)] || item.title!,
                link: item.link,
                guid: item.guid,
                author: item.creator || item.author,
                pubDate: item.pubDate ? parseDate(item.pubDate) : undefined,
                category: item.categories,
                ...(await cache.tryGet(translations ? `${item.link}:zh-CN` : item.link!, () => fetchArticle(item.link!, translations))),
            }),
            { concurrency: 3 }
        ),
    };
}

function normalizeTranslationKey(value: string) {
    return decodeHTML(value)
        .replaceAll(/\sdata-astro-cid-[\w-]+(?:="[^"]*")?/g, '')
        .replaceAll(/\s+/g, ' ')
        .trim();
}

async function fetchTranslations(): Promise<Record<string, string>> {
    const html = await ofetch(`${baseUrl}/blog`, { responseType: 'text' });
    const $ = load(html);
    const layoutPath = $('script[src*="/BaseLayout."]').attr('src');
    if (!layoutPath) {
        throw new Error('Antigravity Blog language loader not found');
    }
    const layoutUrl = new URL(layoutPath, baseUrl).href;
    const layout = await ofetch(layoutUrl, { responseType: 'text' });
    const runtimePath = layout.match(/["'](\.\/runtime\.[^"']+\.js)["']/)?.[1];
    if (!runtimePath) {
        throw new Error('Antigravity Blog language runtime not found');
    }
    const runtimeUrl = new URL(runtimePath, layoutUrl).href;
    const runtime = await ofetch(runtimeUrl, { responseType: 'text' });
    const localePath = runtime.match(/"\.\/locales\/zh-CN\/blog\.json"\s*:\s*\(\)\s*=>[\s\S]*?import\(\s*[`"']([^`"']+)[`"']\s*\)/)?.[1];
    if (!localePath) {
        throw new Error('Antigravity Blog official Chinese translations not found');
    }
    const source = await ofetch(new URL(localePath, runtimeUrl).href, { responseType: 'text' });
    // Raw transfer reserves a 6 GiB buffer, which exceeds serverless memory limits.
    const { program } = await parseScriptSource(source, false);
    const translations: Record<string, string> = {};
    for (const statement of program.body) {
        if (statement.type !== 'VariableDeclaration') {
            continue;
        }
        for (const { init } of statement.declarations) {
            if (
                init?.type !== 'CallExpression' ||
                init.callee.type !== 'MemberExpression' ||
                init.callee.object.type !== 'Identifier' ||
                init.callee.object.name !== 'JSON' ||
                init.callee.property.type !== 'Identifier' ||
                init.callee.property.name !== 'parse'
            ) {
                continue;
            }
            const argument = init.arguments[0];
            if (argument?.type !== 'TemplateLiteral' || argument.expressions.length) {
                continue;
            }
            const data = JSON.parse(argument.quasis[0].value.cooked!) as Record<string, string | { textMap?: Record<string, string> }>;
            for (const [key, value] of Object.entries(data)) {
                const entries = typeof value === 'string' ? [[key, value]] : Object.entries(value.textMap || {});
                for (const [original, translated] of entries) {
                    translations[normalizeTranslationKey(original)] = translated;
                }
            }
        }
    }
    if (!Object.keys(translations).length) {
        throw new Error('Antigravity Blog Chinese translation data could not be parsed');
    }
    return translations;
}

async function fetchArticle(link: string, translations?: Record<string, string>) {
    const html = await ofetch(link, { responseType: 'text' });
    const $ = load(html);
    const article = $('.post .content-section').first();
    if (!article.text().trim()) {
        throw new Error(`Antigravity Blog article content not found: ${link}`);
    }

    const content = $('<div>').append($('.post > .hero-image-wrapper').first(), article);
    content.find('script, style, button, .bottom-share-wrapper, .post-newsletter-wrapper, .button-container').remove();
    if (translations) {
        content.find('h1, h2, h3, h4, h5, h6, p, li, figcaption, blockquote, th, td, .caption').each((_, element) => {
            const node = $(element);
            if (node.closest('pre, code').length || node.find('p, ul, ol, pre, img, video, audio, iframe').length) {
                return;
            }
            const translated = translations[normalizeTranslationKey(node.html() || '')] || translations[normalizeTranslationKey(node.text())];
            if (translated) {
                node.html(translated);
            }
        });
        content
            .find('*')
            .not('pre, code')
            .contents()
            .each((_, node) => {
                if (node.type !== 'text' || $(node).closest('pre, code').length) {
                    return;
                }
                const translated = translations[normalizeTranslationKey(node.data)];
                if (translated) {
                    node.data = node.data.replace(node.data.trim(), () => translated);
                }
            });
    }
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

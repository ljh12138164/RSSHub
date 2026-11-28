import { load } from 'cheerio';

import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';

import renderDescription from './templates/description';
import { extractForumThreadDates, extractNextData } from './utils';

export const route: Route = {
    path: '/all/:id?',
    categories: ['bbs'],
    example: '/hupu/all/topic-daily',
    parameters: { id: '编号，可在对应热帖版面 URL 中找到，默认为步行街每日话题' },
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
            source: ['bbs.hupu.com/topic-daily'],
            target: '/all/topic-daily',
        },
    ],
    name: '热帖',
    maintainers: ['nczitzk'],
    handler,
    description: `::: tip
更多热帖版面参见 [论坛](https://bbs.hupu.com)
:::`,
};

async function handler(ctx) {
    const id = ctx.req.param('id') ?? 'topic-daily';

    const rootUrl = 'https://bbs.hupu.com';
    const currentUrl = `${rootUrl}/${id}`;

    const response = await got({
        method: 'get',
        url: currentUrl,
    });

    const $ = load(response.data);
    const threadDates = extractForumThreadDates($);

    let items = $('div.t-info > a, a.p-title')
        .toArray()
        .map((item): DataItem & { link: string } => {
            const $item = $(item);

            return {
                title: $item.text(),
                link: `https://m.hupu.com/bbs${$item.attr('href')}`,
                pubDate: threadDates.get($item.attr('href')!),
            };
        });

    items = await Promise.all(
        items.map((item) =>
            cache.tryGet(`hupu:thread:v2:${item.link}`, async () => {
                try {
                    const detailResponse = await got({
                        method: 'get',
                        url: item.link,
                    });

                    const content = load(detailResponse.data);

                    const body = content('.bbs-content').first();
                    body.find('.hupu-img').each((_, element) => {
                        const image = content(element);
                        const src = image.attr('data-gif') || image.attr('data-origin') || image.attr('src');
                        if (src) {
                            image.replaceWith(content('<img>').attr('src', src));
                        }
                    });
                    body.find('video').attr({ controls: '', preload: 'none' });
                    const videos = content('video.hupu-post-video')
                        .not(body.find('video'))
                        .toArray()
                        .map((video) => {
                            const element = content(video);
                            return { src: element.attr('src') || element.find('source').first().attr('src'), poster: element.attr('poster') };
                        });

                    return {
                        ...item,
                        author: content('.bbs-user-wrapper-content-name-span').first().text(),
                        description: renderDescription(body.html(), videos, getReplies(detailResponse.data)),
                    };
                } catch {
                    // no-empty
                }

                return item;
            })
        )
    );

    return {
        title: `虎扑社区 - ${$('.middle-title, .bbs-sl-web-intro-detail-title').text()}`,
        link: currentUrl,
        item: items,
    };
}

interface Reply {
    pid: number;
    user?: { username?: string };
    content?: string;
    light?: number;
    hide?: boolean;
    illegal?: boolean;
    isHidden?: boolean;
    isDelete?: boolean;
    isAudit?: boolean;
    isSelfDelete?: boolean;
}

interface ReplyPage {
    props?: { pageProps?: { initialRepliesData?: { lightReplies?: Reply[]; initialReplies?: Reply[] } } };
}

function isPublicReply(reply: Reply) {
    return !reply.hide && !reply.illegal && !reply.isHidden && !reply.isDelete && !reply.isAudit && !reply.isSelfDelete;
}

function getReplies(html: string) {
    let data: ReplyPage['props'];
    try {
        data = extractNextData<ReplyPage>(html).props;
    } catch {
        return [];
    }
    const replies = data?.pageProps?.initialRepliesData;
    const unique = new Map<number, Reply>();
    for (const reply of [...(replies?.lightReplies ?? []), ...(replies?.initialReplies ?? [])]) {
        if (isPublicReply(reply) && reply.content && !unique.has(reply.pid)) {
            unique.set(reply.pid, reply);
        }
    }
    return unique
        .values()
        .toArray()
        .map((reply) => ({ author: reply.user?.username, text: load(reply.content!, null, false).text().trim(), likes: reply.light }))
        .filter((reply) => reply.text)
        .slice(0, 3);
}

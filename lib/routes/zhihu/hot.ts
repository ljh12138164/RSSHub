import { load } from 'cheerio';
import { escapeText } from 'entities';
import pMap from 'p-map';

import { config } from '@/config';
import type { Route } from '@/types';
import { ViewType } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';

import { withZhihuClient } from './utils';

export const route: Route = {
    path: '/hot/:category?',
    categories: ['social-media'],
    example: '/zhihu/hot',
    view: ViewType.Articles,
    features: {
        requireConfig: [
            {
                name: 'ZHIHU_COOKIES',
                description: '',
                optional: true,
            },
        ],
        requirePuppeteer: false,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '知乎热榜',
    description: '每个热门问题附带最多三条按热度排序的公开评论。评论不可用时保留问题简介。',
    maintainers: ['nczitzk', 'pseudoyu', 'DIYgod'],
    handler,
};

async function handler(ctx) {
    const category = ctx.req.param('category');
    if (category) {
        ctx.set('redirect', '/zhihu/hot');
        return null;
    }

    const cookie = config.zhihu.cookies;

    const response = await got({
        method: 'get',
        url: 'https://api.zhihu.com/topstory/hot-lists/total?limit=10&reverse_order=0',
        headers: {
            Cookie: cookie,
        },
    });

    const questions: HotQuestion[] = response.data.data;
    const items = await withZhihuClient('https://www.zhihu.com/hot', (client) =>
        pMap(
            questions,
            async (item) => {
                const questionId = item.target.url ? item.target.url.split('/').pop() : String(item.target.id);
                const link = `https://www.zhihu.com/question/${questionId}`;
                let commentsHtml = '';
                try {
                    commentsHtml = await cache.tryGet(
                        `zhihu:hot:comments:${questionId}`,
                        async () => {
                            const result = await client.get<{ data: HotComment[] }>(`/api/v4/comment_v5/questions/${questionId}/root_comment?order_by=score&limit=3&offset=`);
                            const comments = result.data
                                .filter((comment) => !comment.is_delete && !comment.collapsed && !comment.reviewing && !comment.is_visible_only_to_myself)
                                .slice(0, 3)
                                .map((comment) => {
                                    const text = load(comment.content, null, false).text().trim();
                                    return text ? `<li><p>${escapeText(comment.author.name)}：</p><blockquote>${escapeText(text)}</blockquote></li>` : '';
                                })
                                .filter(Boolean);
                            return comments.length ? `<h2>热门评论</h2><ol>${comments.join('')}</ol><p><a href="${link}">查看原问题与完整讨论</a></p>` : '';
                        },
                        config.cache.routeExpire,
                        false
                    );
                } catch {
                    logger.warn(`zhihu: comments unavailable for question ${questionId}; keeping the question excerpt`);
                }
                return {
                    link,
                    title: item.target.title,
                    pubDate: parseDate(item.target.created * 1000),
                    description: `${item.target.excerpt ? `<p>${item.target.excerpt}</p>` : ''}${commentsHtml}`,
                };
            },
            { concurrency: 3 }
        )
    );

    return {
        title: '知乎热榜',
        link: 'https://www.zhihu.com/hot',
        item: items,
    };
}

interface HotQuestion {
    target: {
        url?: string;
        id: number | string;
        title: string;
        created: number;
        excerpt?: string;
    };
}

interface HotComment {
    content: string;
    author: { name: string };
    is_delete: boolean;
    collapsed: boolean;
    reviewing: boolean;
    is_visible_only_to_myself: boolean;
}

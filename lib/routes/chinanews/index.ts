import { load } from 'cheerio';

import type { DataItem, Language, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const rootUrl = 'https://www.chinanews.com.cn';

export const route: Route = {
    path: '/',
    categories: ['traditional-media'],
    example: '/chinanews',
    radar: [
        {
            source: ['chinanews.com.cn/'],
            target: '',
        },
    ],
    name: '最新',
    maintainers: ['yuxinliu-alex'],
    handler,
    url: 'chinanews.com.cn/',
};

async function handler(ctx) {
    const language: Language = 'zh-CN';
    const currentUrl = `${rootUrl}/scroll-news/news1.html`;
    const response = await got({
        method: 'get',
        url: currentUrl,
    });
    const $ = load(response.data);
    const limit = ctx.req.query('limit');
    const list = $('a', '.dd_bt')
        .toArray()
        .map((item): DataItem => ({
            link: rootUrl + $(item).attr('href'),
            title: $(item).text(),
        }))
        .slice(0, limit ? Number.parseInt(limit) : 50);

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(`chinanews:published-v2:${item.link}`, async () => {
                const detailResponse = await got({
                    method: 'get',
                    url: item.link,
                });
                const content = load(detailResponse.data);
                content('.adInContent').remove();
                if (content('div.content_desc').length > 0) {
                    item.description = content('div.content_desc').html();
                    item.author = content('a.source').text();
                    const info = content('p', '.left').text().trim().slice(5).split(' ');
                    item.author = info[2].trim();
                    item.pubDate = timezone(parseDate(info[0] + info[1], 'YYYY年MM月DD日HH:mm'), 8);
                } else if (content('div.t3').length > 0) {
                    item.description = content('div.t3').html();
                    const info = content('div[style="text-align:right;font-size:12px;"]').text().slice(5).split(' ');
                    item.author = info[2];
                    item.pubDate = timezone(parseDate(info[0] + info[1], 'YYYY-MM-DDHH:mm'), 8);
                } else {
                    item.description = content('div.left_zw').html();
                    const info = content('div.left-t')
                        .contents()
                        .filter((_, el) => el.type === 'text')
                        .text()
                        .split('\u{3000}');
                    item.pubDate = timezone(parseDate(info[0], 'YYYY年MM月DD日 HH:mm'), 8);
                    item.author = info[1] + content('a.source').text();
                }
                const dateText =
                    content('#pubtime_baidu').first().text() ||
                    content('.source_time').first().text() ||
                    content('p')
                        .filter((_, element) => /^发布时间[：:]/.test(content(element).text().trim()))
                        .first()
                        .text();
                const match = dateText.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                if (match) {
                    const [, year, month, day, hour, minute, second = '00'] = match;
                    item.pubDate = timezone(parseDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}:${second}`, 'YYYY-MM-DD HH:mm:ss', true), 8);
                }
                if (item.pubDate && Number.isNaN(new Date(item.pubDate).getTime())) {
                    delete item.pubDate;
                }
                return item;
            })
        )
    );
    return {
        title: '中国新闻网',
        link: currentUrl,
        description: '中国新闻网（简称“中新网”），由中国新闻社主办，为中央重点新闻网站。',
        language,
        item: items,
    };
}

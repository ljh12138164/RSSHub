export const BASE_URL = 'https://aihot.news';

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export function unpackTurboStream<T = any>(html: string, dataKey: string): T {
    const marker = 'streamController.enqueue(';
    const start = html.indexOf(marker);
    if (start === -1) {
        throw new Error('未能在网页中找到 streamController.enqueue 数据块');
    }
    const quotedStart = start + marker.length;
    const end = html.indexOf(');</script>', quotedStart);
    if (end === -1) {
        throw new Error('未能在网页中找到 streamController.enqueue 闭合标记');
    }
    const quoted = html.slice(quotedStart, end).trim();
    const unescaped = JSON.parse(quoted);
    const turboArr = JSON.parse(unescaped);

    function unpack(idx: any): any {
        if (idx === -1 || idx === -5) {
            return null;
        }
        if (typeof idx !== 'number') {
            return idx;
        }
        const val = turboArr[idx];
        if (val === null || typeof val !== 'object') {
            return val;
        }
        if (Array.isArray(val)) {
            return val.map((item) => unpack(item));
        }
        const obj: Record<string, any> = {};
        for (const [k, v] of Object.entries(val)) {
            if (k.startsWith('_')) {
                const propKey = turboArr[Math.trunc(Number(k.slice(1)))];
                obj[propKey] = unpack(v);
            } else {
                obj[k] = unpack(v);
            }
        }
        return obj;
    }

    const root = unpack(0);
    const result = root?.loaderData?.[dataKey];
    if (!result) {
        throw new Error(`解包数据失败：缺失 ${dataKey}`);
    }
    return result as T;
}

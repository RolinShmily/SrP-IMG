

// ---------------------------------------------------------------------------
// Random image redirect endpoint.
//
// External contract (see README):
//   ?img=h        -> 302 to a random horizontal image
//   ?img=v        -> 302 to a random vertical image
//   ?img=a        -> 302 to a random avatar image
//   ?img=gif      -> 302 to a random gif image
//   ?img=ua       -> 302, orientation chosen from the User-Agent
//   anything else -> 200 plus a plain-text usage notice
//
// Images are served from /<dir>/<hex><ext>, one file per hash slot. The slot
// count is the whole hash space (16 ** hash length), and gen_img.py fills every
// slot at build time, so any randomly chosen slot is guaranteed to exist.
// ---------------------------------------------------------------------------

const HASH_LENGTH = 2;
const IMAGE_EXT = '.jpg';

const TARGETS = {
    'a': { dir: 'a', slots: 256, ext: '.jpeg', label: 'avatar' },
    'gif': { dir: 'gif', slots: 256, ext: '.gif', label: 'gif' },
    'h': { dir: 'h', slots: 256, ext: '.jpg', label: 'horizontal' },
    'v': { dir: 'v', slots: 256, ext: '.jpg', label: 'vertical' },
};

const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

const USAGE_TEXT = [
    '🖼️ 随机图片展示器',
    '',
    '使用方法:',
    '• ?img=a - 获取头像随机图片',
    '• ?img=gif - 获取GIF 随机动图',
    '• ?img=h - 获取横屏随机图片',
    '• ?img=v - 获取竖屏随机图片',
    '• ?img=ua - 根据设备类型自动选择横屏/竖屏图片',
    '',
].join('\n');

function randomImagePath(target) {
    const slot = Math.floor(Math.random() * target.slots);
    const hex = slot.toString(16).padStart(HASH_LENGTH, '0');
    return '/' + target.dir + '/' + hex + (target.ext || IMAGE_EXT);
}

function resolveTarget(request) {
    const requested = new URL(request.url).searchParams.get('img');

    if (requested === 'ua') {
        const ua = request.headers.get('User-Agent') || '';
        return (MOBILE_UA.test(ua) ? TARGETS.v : TARGETS.h) || null;
    }

    return Object.prototype.hasOwnProperty.call(TARGETS, requested) ? TARGETS[requested] : null;
}

function handleRequest(request) {
    try {
        const target = resolveTarget(request);

        if (!target) {
            return new Response(USAGE_TEXT, {
                status: 200,
                headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
            });
        }

        if (target.slots < 1) {
            return new Response('No ' + target.label + ' images', { status: 404, headers: CORS_HEADERS });
        }

        return new Response(null, {
            status: 302,
            headers: {
                Location: randomImagePath(target),
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                ...CORS_HEADERS,
            },
        });
    } catch (err) {
        console.error('pic handler failed:', err);
        return new Response('Internal Error', { status: 500, headers: CORS_HEADERS });
    }
}


export function onRequest(context) {
    return handleRequest(context.request);
}


// ---------------------------------------------------------------------------
// Random image redirect endpoint.
//
// External contract (see README):
//   ?img=h        -> 302 to a random horizontal image
//   ?img=v        -> 302 to a random vertical image
//   ?img=a        -> 302 to a random avatar image
//   ?img=gif      -> 302 to a random gif image
//   ?img=ua       -> 302, orientation chosen from the User-Agent
//   anything else -> 404 Not Found
//
// Security & Access Control:
//   - Referer Hotlinking Protection: Whitelisted hostnames (*.srprolin.top,
//     *.srprolin.com, localhost, 127.0.0.1) or empty/missing Referer allowed;
//     disallowed Referer requests receive 403 Forbidden.
//   - Dynamic CORS: Whitelisted Origins receive Access-Control-Allow-Origin
//     and Vary: Origin headers; OPTIONS preflight returns 204.
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

function isAllowedHost(hostname) {
    if (!hostname) return false;
    const host = hostname.toLowerCase();
    return (
        host === 'srprolin.top' ||
        host.endsWith('.srprolin.top') ||
        host === 'srprolin.com' ||
        host.endsWith('.srprolin.com') ||
        host === 'localhost' ||
        host === '127.0.0.1'
    );
}

function checkReferer(request) {
    const referer = request.headers.get('Referer');
    if (!referer || referer.trim() === '') {
        return true;
    }
    try {
        const url = new URL(referer);
        return isAllowedHost(url.hostname);
    } catch {
        return false;
    }
}

function getCorsHeaders(request) {
    const origin = request.headers.get('Origin');
    if (!origin) {
        return {};
    }
    try {
        const url = new URL(origin);
        if (isAllowedHost(url.hostname)) {
            return {
                'Access-Control-Allow-Origin': origin,
                'Vary': 'Origin',
            };
        }
    } catch {
        // Ignore invalid Origin URL
    }
    return {};
}

function handleOptions(request) {
    const origin = request.headers.get('Origin');
    if (origin) {
        try {
            const url = new URL(origin);
            if (isAllowedHost(url.hostname)) {
                return new Response(null, {
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': origin,
                        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
                        'Access-Control-Max-Age': '86400',
                        'Vary': 'Origin',
                    },
                });
            }
        } catch {
            // Ignore invalid Origin URL
        }
    }
    return new Response(null, { status: 204 });
}

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
        if (request.method === 'OPTIONS') {
            return handleOptions(request);
        }

        if (!checkReferer(request)) {
            return new Response('403 Forbidden: Hotlinking not allowed', {
                status: 403,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        const corsHeaders = getCorsHeaders(request);
        const target = resolveTarget(request);

        if (!target) {
            return new Response('404 Not Found', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
            });
        }

        if (target.slots < 1) {
            return new Response('404 Not Found', {
                status: 404,
                headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
            });
        }

        return new Response(null, {
            status: 302,
            headers: {
                Location: randomImagePath(target),
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                ...corsHeaders,
            },
        });
    } catch (err) {
        console.error('pic handler failed:', err);
        return new Response('Internal Error', { status: 500, headers: getCorsHeaders(request) });
    }
}

export function onRequest(context) {
    return handleRequest(context.request);
}



function isMobileDevice(ua) {
    if(!ua) return false;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua.toLowerCase());
}

function hexName(idx) {
    return idx.toString(16).padStart(2, '0') + '.jpg';
}

async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        const img = url.searchParams.get('img');

        const maxH = 256;
        const maxV = 256;

        if(img === 'h') {
            if(!maxH) return new Response('No horizontal images', {status:404});
            const idx = Math.floor(Math.random()*maxH);
            const location = '/h/' + hexName(idx);
            return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
        } else if(img === 'v') {
            if(!maxV) return new Response('No vertical images', {status:404});
            const idx = Math.floor(Math.random()*maxV);
            const location = '/v/' + hexName(idx);
            return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
        } else if(img === 'ua') {
            const ua = request.headers.get('User-Agent') || '';
            if(isMobileDevice(ua)) {
                if(!maxV) return new Response('No vertical images', {status:404});
                const idx = Math.floor(Math.random()*maxV);
                const location = '/v/' + hexName(idx);
                return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
            } else {
                if(!maxH) return new Response('No horizontal images', {status:404});
                const idx = Math.floor(Math.random()*maxH);
                const location = '/h/' + hexName(idx);
                return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
            }
        }

        const help = `🖼️ 随机图片展示器\n\n使用方法:\n• ?img=h - 获取横屏随机图片\n• ?img=v - 获取竖屏随机图片\n• ?img=ua - 根据设备类型自动选择图片\n`;
        return new Response(help, {status:200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }});

    } catch(err) {
        return new Response('Internal Error: ' + (err && err.message), {status:500});
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/pic' || url.pathname === '/api/pic') {
            return handleRequest(request);
        }

        return env.ASSETS.fetch(request);
    }
};

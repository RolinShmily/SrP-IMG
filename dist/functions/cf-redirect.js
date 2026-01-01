
// Auto-generated Cloudflare Pages Function (server-side)
export function onRequest(context) {
    return handleRequest(context.request);
}

function isMobileDevice(ua) {
    if(!ua) return false;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua.toLowerCase());
}

function hexName(idx) {
    return idx.toString(16).padStart(3, '0') + '.jpg';
}

async function handleRequest(request) {
    try {
        const url = new URL(request.url);
        const img = url.searchParams.get('img');

        const maxH = 4096;
        const maxV = 4096;

        if(img === 'h') {
            if(!maxH) return new Response('No horizontal images', {status:404});
            const idx = Math.floor(Math.random()*maxH);
            const location = '/ri/h/' + hexName(idx);
            return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
        } else if(img === 'v') {
            if(!maxV) return new Response('No vertical images', {status:404});
            const idx = Math.floor(Math.random()*maxV);
            const location = '/ri/v/' + hexName(idx);
            return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
        } else if(img === 'ua') {
            const ua = request.headers.get('User-Agent') || '';
            if(isMobileDevice(ua)) {
                if(!maxV) return new Response('No vertical images', {status:404});
                const idx = Math.floor(Math.random()*maxV);
                const location = '/ri/v/' + hexName(idx);
                return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
            } else {
                if(!maxH) return new Response('No horizontal images', {status:404});
                const idx = Math.floor(Math.random()*maxH);
                const location = '/ri/h/' + hexName(idx);
                return new Response(null, {status:302, headers: { 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }});
            }
        }

        // Help text when no img param
        const help = `🖼️ 随机图片展示器

使用方法:
• ?img=h - 获取横屏随机图片
• ?img=v - 获取竖屏随机图片
• ?img=ua - 根据设备类型自动选择图片
`;
        return new Response(help, {status:200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }});

    } catch(err) {
        return new Response('Internal Error: ' + (err && err.message), {status:500});
    }
}

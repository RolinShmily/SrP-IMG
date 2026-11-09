// Cloudflare Workers entry: random-image redirects plus asset protection.
//
// All request policy lives in `./policy.js`; this file only routes between the
// two API paths and the static asset binding.
import { SLOT_FORMATS } from './slot_formats.js';
import { TARGETS } from './targets.js';
import {
    checkAccess,
    errorResponse,
    handleRequest,
    misconfigured,
    resolvePolicy,
    responseHeaders,
} from './policy.js';

// Slot format codes emitted by `python -m pipeline` into `slot_formats.js`.
// The pool copies source bytes verbatim, so for a PNG kept in a `.jpg` slot the
// suffix-derived header is wrong; this table is the ground truth.
const SLOT_MIME = {
    j: 'image/jpeg',
    p: 'image/png',
    g: 'image/gif',
    w: 'image/webp',
};

const SLOT_IMAGE = /\.(?:jpe?g|png|gif|webp)$/i;
const SLOT_STEM = /^([0-9a-f]+)\./i;

// `null` = not a generated category image, so the asset binding answers as-is.
// `slot` is null when the name is not a hex slot (e.g. `missing.jpg`), which
// keeps the protection behaviour of a hand-placed file unchanged.
function parseCategoryImage(pathname) {
    let parts;
    try {
        parts = decodeURIComponent(pathname).split('/');
    } catch {
        return null;
    }
    if (parts.length !== 3 || !Object.prototype.hasOwnProperty.call(TARGETS, parts[1])) return null;
    // Protect image files in generated categories, including encoded paths, but
    // do not gate HTML, counts.json, application scripts, icons or other metadata.
    if (!SLOT_IMAGE.test(parts[2])) return null;
    const stem = SLOT_STEM.exec(parts[2]);
    return { category: parts[1], slot: stem ? Number.parseInt(stem[1], 16) : null };
}

function withSlotContentType(response, category, slot) {
    // Only a successful asset response describes a real slot. A 404/304 must
    // keep its own headers instead of claiming an image type for an error body.
    if (!response.ok) return response;
    const formats = SLOT_FORMATS[category];
    if (typeof formats !== 'string' || !Number.isInteger(slot)) return response;
    const mime = slot >= 0 && slot < formats.length ? SLOT_MIME[formats[slot]] : undefined;
    if (!mime) return response;
    const headers = new Headers(response.headers);
    headers.set('Content-Type', mime);
    // HEAD answers carry no body but must keep the corrected header.
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/pic') return handleRequest(request, env);
        const resolved = resolvePolicy(env);
        if (resolved.error) return misconfigured(request);
        const policy = resolved.policy;
        const image = parseCategoryImage(url.pathname);
        if (!image) return env.ASSETS.fetch(request);
        if (!policy.protectAssetImages) {
            // Unprotected assets keep the static-asset cache policy; only the
            // Content-Type is corrected to describe the real bytes.
            const asset = await env.ASSETS.fetch(request);
            return withSlotContentType(asset, image.category, image.slot);
        }
        // Requires assets.run_worker_first = true. Otherwise asset hits bypass
        // the Worker entirely; env.ASSETS.fetch safely delegates after the check.
        try {
            const blocked = checkAccess(request, policy);
            if (blocked) return blocked;
            const asset = await env.ASSETS.fetch(request);
            const protectedResponse = new Response(request.method === 'HEAD' ? null : asset.body, {
                status: asset.status,
                statusText: asset.statusText,
                headers: responseHeaders(request, policy, asset.headers),
            });
            return withSlotContentType(protectedResponse, image.category, image.slot);
        } catch (err) {
            console.error('protected image asset failed:', err);
            return errorResponse(request, policy, 500, 'Internal Error');
        }
    }
};

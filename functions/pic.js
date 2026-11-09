// Cloudflare Pages Functions are bundled from this directory, but the handler
// is shared with the Workers entry so there is exactly one policy engine.
export { onRequest } from '../worker/pages.js';

// Cloudflare Pages adapter: this entry protects /pic only. /api/pic needs a
// separate Pages route; static image protection requires Pages middleware or
// edge rules. Read the policy from `context.env` so the allowlist lives in
// Pages environment variables rather than in this bundle.
import { handleRequest } from './policy.js';

export function onRequest(context) {
    return handleRequest(context.request, context.env);
}

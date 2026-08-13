/**
 * Cloudflare Pages Function — /go/<slug>
 *
 * Tüm mantık lib/go.js içinde (test edilebilmesi için). Burası sadece
 * Pages context'ini oraya bağlar.
 */

import { handleGo } from "../../lib/go.js";

export const onRequest = (context) =>
	handleGo({
		request: context.request,
		env: context.env,
		slug: context.params.slug,
		waitUntil: (promise) => context.waitUntil(promise),
	});

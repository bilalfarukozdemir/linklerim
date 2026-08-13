/**
 * Vercel Edge Function — /go/<slug>
 *
 * Edge runtime web standartlarını (Request/Response/fetch) kullandığı için
 * mantık lib/go.js içinde olduğu gibi çalışıyor. Burası sadece bağlantı katmanı.
 *
 * vercel.json'daki rewrite kuralı /go/:slug adresini buraya yönlendirir.
 */

import { handleGo } from "../../lib/go.js";
import { d1FromEnv } from "../../lib/d1.js";

export const config = { runtime: "edge" };

export default async function handler(request, context) {
	const url = new URL(request.url);
	const slug = url.pathname.split("/").filter(Boolean).pop() ?? "";

	// waitUntil yoksa hiç geçme: handleGo o zaman kaydı bekleyerek yapar,
	// yoksa istek biterken yazma yarıda kalır.
	const waitUntil =
		typeof context?.waitUntil === "function" ? (promise) => context.waitUntil(promise) : undefined;

	return handleGo({
		request,
		db: d1FromEnv(process.env),
		slug,
		baseUrl: url.origin,
		waitUntil,
	});
}

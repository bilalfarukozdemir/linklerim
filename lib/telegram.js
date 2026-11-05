/**
 * Telegram Bot API istemcisi: yalnız bildirim göndermek ve düğme cevaplamak için.
 *
 * Token ve sohbet kimliği repoda DEĞİL, Vercel ortam değişkenlerinde:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
 */

const API = "https://api.telegram.org";

/** Eksik ayarda null döner: talep yine kaydedilir, panelde görünür. */
export function telegramFromEnv(env = {}, fetchImpl) {
	const token = String(env.TELEGRAM_BOT_TOKEN ?? "").trim();
	const chatId = String(env.TELEGRAM_CHAT_ID ?? "").trim();
	if (!token || !chatId) return null;
	const doFetch = fetchImpl ?? fetch;

	async function cagir(metot, govde) {
		const yanit = await doFetch(`${API}/bot${token}/${metot}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(govde),
			signal: AbortSignal.timeout(5000),
		});
		const veri = await yanit.json().catch(() => null);
		// Hata iletisine token'lı adres karışmasın diye yalnız metot adı yazılır.
		if (!yanit.ok || veri?.ok !== true) {
			throw new Error(`Telegram ${metot} başarısız: HTTP ${yanit.status} ${veri?.description ?? ""}`);
		}
		return veri.result;
	}

	return {
		chatId,
		gonder: (text, dugmeler) =>
			cagir("sendMessage", {
				chat_id: chatId,
				text,
				parse_mode: "HTML",
				link_preview_options: { is_disabled: true },
				reply_markup: dugmeler ? { inline_keyboard: dugmeler } : undefined,
			}),
		duzenle: (mesajId, text, dugmeler) =>
			cagir("editMessageText", {
				chat_id: chatId,
				message_id: mesajId,
				text,
				parse_mode: "HTML",
				link_preview_options: { is_disabled: true },
				reply_markup: dugmeler ? { inline_keyboard: dugmeler } : undefined,
			}),
		cevapla: (sorguId, text) => cagir("answerCallbackQuery", { callback_query_id: sorguId, text }),
	};
}

export function htmlKacir(metin) {
	return String(metin ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

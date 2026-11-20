/**
 * Бесплатный Cloudflare Worker для Telegram Stars (@heuristic_p1_bot).
 * Работает напрямую между серверами Telegram и Cloudflare (~15 мс, без участия VPS в РФ).
 *
 * Деплой за 1 минуту:
 * 1. https://dash.cloudflare.com -> Workers & Pages -> Create Worker -> вставить этот код.
 * 2. Settings -> Variables -> Add Secret: BOT_TOKEN = <токен @heuristic_p1_bot>
 * 3. Один раз открыть в браузере (или curl):
 *    https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('ok');
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('ok');
    }

    const api = (method, body) =>
      fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    // 1. Мгновенное подтверждение счёта Telegram Stars (обязательно за < 10 сек)
    if (update.pre_checkout_query) {
      await api('answerPreCheckoutQuery', {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
      return new Response('ok');
    }

    // 2. Благодарность после успешной оплаты
    if (update.message?.successful_payment) {
      await api('sendMessage', {
        chat_id: update.message.chat.id,
        text: 'Оплата прошла успешно! Модуль уже открыт в приложении «КРЕСЛО».',
      });
      return new Response('ok');
    }

    // 3. Кнопка запуска Mini App по команде /start
    if (update.message?.text?.startsWith('/start')) {
      await api('sendMessage', {
        chat_id: update.message.chat.id,
        text: 'КРЕСЛО — симулятор рабочих решений и короткие проверки по ссылке. Нажмите «Играть», чтобы открыть приложение:',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Открыть КРЕСЛО', web_app: { url: 'https://kreslo.heuristics.ru/' } }],
          ],
        },
      });
    }

    return new Response('ok');
  },
};

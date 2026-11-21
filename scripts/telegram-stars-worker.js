/**
 * Бесплатный Cloudflare Worker для Telegram Stars (@vkreslegame).
 * Работает напрямую между серверами Telegram и Cloudflare (~15 мс, без участия VPS в РФ).
 *
 * Деплой:
 * 1. https://dash.cloudflare.com -> Workers & Pages -> kreslo-stars -> Edit code -> Deploy.
 * 2. Settings -> Variables and Secrets -> BOT_TOKEN = <токен @vkreslegame>
 * 3. Webhook: https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://kreslo-stars.koshernoe-detya.workers.dev/
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

    // 2. Благодарность после успешной оплаты модуля или сейва
    if (update.message?.successful_payment) {
      const payload = update.message.successful_payment.invoice_payload || '';
      const isSave = payload.includes('save');
      await api('sendMessage', {
        chat_id: update.message.chat.id,
        text: isSave
          ? 'Кресло удержано! Можете продолжать смену.'
          : 'Оплата прошла успешно! Модуль открыт и сохранён в облаке Telegram.',
      });
      return new Response('ok');
    }

    const text = update.message?.text || '';

    // 3. Обязательные команды правил Telegram Stars (/terms и /paysupport)
    if (text.startsWith('/terms')) {
      await api('sendMessage', {
        chat_id: update.message.chat.id,
        text: 'Условия использования «КРЕСЛО»:\n• Покупки за Telegram Stars открывают цифровой доступ к дополнительным игровым модулям (Блок 2, Блок 3) или мгновенному продолжению текущей смены.\n• Открытые модули сохраняются за вашим аккаунтом в облаке Telegram.\n• По вопросам возврата ошибочного списания используйте команду /paysupport.',
      });
      return new Response('ok');
    }

    if (text.startsWith('/paysupport')) {
      await api('sendMessage', {
        chat_id: update.message.chat.id,
        text: 'Поддержка по платежам «КРЕСЛО»:\nЕсли после оплаты Stars модуль не открылся автоматически, перезапустите мини-приложение кнопкой «Играть» (данные подтянутся из облака). Если нужна помощь или возврат по технической ошибке — ответьте в этот чат с временем платежа.',
      });
      return new Response('ok');
    }

    // 4. Кнопка запуска Mini App по команде /start (с пробросом deep-link параметра)
    if (text.startsWith('/start')) {
      const parts = text.trim().split(/\s+/);
      const rawParam = parts[1] || '';
      const param = rawParam ? `&tgWebAppStartParam=${encodeURIComponent(rawParam)}` : '';
      const isDuel = rawParam.startsWith('duel_');
      const isDirectPlay = rawParam.startsWith('play_') || rawParam.startsWith('pack_');
      const btnText = isDuel
        ? 'Принять вызов на расклад →'
        : isDirectPlay
          ? 'Начать смену сразу →'
          : 'Открыть КРЕСЛО →';
      await api('sendMessage', {
        chat_id: update.message.chat.id,
        text: isDuel
          ? 'Вам брошен вызов на фиксированный расклад в «КРЕСЛО». Нажмите кнопку ниже, чтобы начать на тех же карточках:'
          : isDirectPlay
            ? 'Колода готова — игра откроется сразу на первой карточке без главного меню:'
            : 'КРЕСЛО — симулятор острых рабочих решений, дуэли на одном раскладе и исторические прецеденты:',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: btnText,
                web_app: { url: `https://cringeprofessionalproject.github.io/kreslo/?bot=vkreslegame${param}` },
              },
            ],
          ],
        },
      });
    }

    return new Response('ok');
  },
};

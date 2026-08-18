module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    return response.status(405).json({ error: "method_not_allowed" });
  }

  return response.status(200).json({
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasChatId: Boolean(process.env.TELEGRAM_CHAT_ID),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
  });
};

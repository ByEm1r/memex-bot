require("dotenv").config();
const { Telegraf } = require("telegraf");
const axios = require("axios");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const API_URL = "http://localhost:5000";

bot.start(async (ctx) => {
    const telegramId = ctx.from.id.toString();
    try {
        await axios.post(`${API_URL}/register`, { telegramId });
        ctx.reply("👋 Hoş geldin! MemeX oyununa katıldın. /menu ile görevleri ve tıklama oyununu görebilirsin.");
    } catch (error) {
        ctx.reply("❌ Bir hata oluştu. Lütfen daha sonra tekrar dene.");
    }
});

bot.command("menu", (ctx) => {
    ctx.reply(
        "📋 *MemeX Menü* 📋\n\n" +
        "💰 /click - Coin kazan\n" +
        "🔁 /recharge - Tıklama hakkını yenile\n" +
        "🎯 /tasks - Görevleri gör\n" +
        "🏆 /leaderboard - Liderlik tablosunu gör\n",
        { parse_mode: "Markdown" }
    );
});

bot.command("click", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    try {
        const response = await axios.post(`${API_URL}/click`, { telegramId });
        ctx.reply(`🎉 Tıklama kaydedildi! Kazandığın coin: ${response.data.coinsEarned}\nKalan tıklamalar: ${response.data.remainingClicks}`);
    } catch (error) {
        ctx.reply("❌ Tıklama hakkın yok veya hata oluştu.");
    }
});

bot.command("recharge", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    try {
        await axios.post(`${API_URL}/recharge`, { telegramId });
        ctx.reply("🔁 Tıklama hakkın yenilendi! Şimdi tekrar /click yazabilirsin.");
    } catch (error) {
        ctx.reply("❌ Tıklama hakkı yenilenemedi.");
    }
});

bot.command("tasks", (ctx) => {
    ctx.reply(
        "🎯 *Görevler* 🎯\n\n" +
        "1️⃣ [Twitter'ı Takip Et](https://x.com/memexairdrop) - 500 Coin\n" +
        "2️⃣ [Telegram'a Katıl](https://t.me/MemeXGloball) - 700 Coin\n" +
        "3️⃣ [Tweet Beğen](https://x.com/memexairdrop/status/1904244723469984157) - 400 Coin\n" +
        "4️⃣ [Tweet RT](https://x.com/memexairdrop/status/1904244723469984157) - 450 Coin\n\n" +
        "✅ Tamamladığın görevi onaylatmak için /completeTask [görev_ismi] yaz.",
        { parse_mode: "Markdown" }
    );
});

bot.command("completeTask", async (ctx) => {
    const [command, taskType] = ctx.message.text.split(" ");
    const telegramId = ctx.from.id.toString();

    const validTasks = ["twitter_follow", "telegram_join", "twitter_like", "twitter_retweet"];
    if (!validTasks.includes(taskType)) {
        return ctx.reply("❌ Geçersiz görev. Lütfen /tasks komutuyla görevleri kontrol et.");
    }

    try {
        const response = await axios.post(`${API_URL}/completeTask`, { telegramId, taskType });
        ctx.reply(`✅ Görev tamamlandı! Kazandığın coin: ${response.data.coinsEarned}`);
    } catch (error) {
        ctx.reply("❌ Görev tamamlanamadı, tekrar dene.");
    }
});

bot.command("leaderboard", async (ctx) => {
    try {
        const response = await axios.get(`${API_URL}/leaderboard`);
        let leaderboardText = "🏆 *Liderlik Tablosu* 🏆\n\n";

        response.data.forEach((user, index) => {
            leaderboardText += `${user.rankIcon} ${index + 1}. @${user.telegramId} - ${user.coins} Coin\n`;
        });

        ctx.reply(leaderboardText, { parse_mode: "Markdown" });
    } catch (error) {
        ctx.reply("❌ Liderlik tablosu yüklenemedi.");
    }
});

bot.launch();
console.log("🤖 Telegram botu çalışıyor...")




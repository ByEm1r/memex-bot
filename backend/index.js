const TelegramBot = require('node-telegram-bot-api');
const token = '7204497566:AAGjGHosKkGBb9ibv2FHCEOt5kBQf3VQ7vc';  // Bot tokeninizi buraya ekleyin
const bot = new TelegramBot(token, { polling: true });

// '/start' komutu tetiklendiğinde
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.chat.username || "User"; // Eğer username yoksa, 'User' yazacak

    const welcomeMessage = `Welcome to MEMEX GAME, ${username} 🎮

💰 Join the MemeX Game bot and earn your first rewards!
✅ Complete simple tasks and withdraw your earnings directly to your wallet! 
🚀 Powered by Electra Protocol, ensuring the lowest fees, fastest transactions, and ultimate security!`;

    // Resmin URL'si (Doğru bir resim linki kullanmalısınız)
    const welcomeImage = 'https://imgur.com/a/VtPNoMr'; // Buraya görselin doğru URL'sini ekleyin

    // Karşılama mesajı ve mini app'e yönlendiren buton
    bot.sendPhoto(chatId, welcomeImage, { caption: welcomeMessage, reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Start the MemeX Game 🎮',
                        web_app: { url: 'https://memex-client.onrender.com' }  // Mini App linkini burada belirtmelisiniz
                    }
                ]
            ]
        } });
});










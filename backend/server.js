require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");

        // MongoDB bağlantısı sağlandığında görev sıfırlama fonksiyonunu çalıştırıyoruz
        resetCompletedTasks();
    })
    .catch((err) => console.log("MongoDB connection error:", err));

// Tüm kullanıcıların completedTasks dizilerini sıfırlayacak kod
const resetCompletedTasks = async () => {
    try {
        // Kullanıcıları buluyor ve completedTasks dizisini sıfırlıyoruz
        await User.updateMany({}, { $set: { completedTasks: [] } });
        console.log("✅ All tasks have been reset for every user.");
    } catch (error) {
        console.error("❌ Error resetting tasks:", error);
    }
};

const UserSchema = new mongoose.Schema({
    telegramId: { type: String, unique: true },
    username: { type: String, default: '' },
    coins: { type: Number, default: 0 },
    clicks: { type: Number, default: 100 },
    lastClickTime: { type: Date, default: null },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    powerUps: { type: Array, default: [] },
    lastDailyClaim: { type: Date, default: null },
    referrer: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    doubleClick: { type: Boolean, default: false },
    autoClick: { type: Boolean, default: false },
    clickPower: { type: Number, default: 50 },
    completedTasks: { type: [String], default: [] }
});

const User = mongoose.model("User", UserSchema);

const levelThresholds = [0, 500, 1000, 2000, 4000, 6000];
const levelRewards = [0, 500, 1000, 2000, 3000, 5000];

function checkLevelUp(user) {
    while (user.level < levelThresholds.length && user.experience >= levelThresholds[user.level]) {
        user.level += 1;
        user.coins += levelRewards[user.level] || 0;
    }
}

app.get("/getUserData", async (req, res) => {
    const { telegramId, ref, username } = req.query;

    if (!telegramId) return res.status(400).json({ message: "telegramId is required" });

    let user = await User.findOne({ telegramId });

    if (!user) {
        user = new User({
            telegramId,
            username: username || "Anonymous"
        });

        console.log("🆕 New user detected:", telegramId);
        if (ref) console.log("🔗 Referrer ID:", ref);

        if (ref && ref !== telegramId) {
            const referrer = await User.findOne({ telegramId: ref });
            if (referrer) {
                user.referrer = ref;
                referrer.referralCount += 1;  // Increment the referrer’s referral count

                // Provide rewards based on the referral count thresholds
                if (referrer.referralCount >= 20) {
                    referrer.coins += 20000;  // 20000 coin reward for 20 referrals
                    referrer.experience += 1000;  // 1000 XP reward for 20 referrals
                    console.log("🔗 20 referrals: Giving 20000 coins and 1000 XP to referrer.");
                } else if (referrer.referralCount >= 10) {
                    referrer.coins += 10000;  // 10000 coin reward for 10 referrals
                    referrer.experience += 500;  // 500 XP reward for 10 referrals
                    console.log("🔗 10 referrals: Giving 10000 coins and 500 XP to referrer.");
                } else if (referrer.referralCount >= 5) {
                    referrer.coins += 5000;  // 5000 coin reward for 5 referrals
                    referrer.experience += 250;  // 250 XP reward for 5 referrals
                    console.log("🔗 5 referrals: Giving 5000 coins and 250 XP to referrer.");
                }

                checkLevelUp(referrer);  // Check if the referrer levels up
                await referrer.save();  // Save the referrer data with updated coins, XP, and referralCount
            }
        }

        await user.save();  // Save the new user data
    } else {
        // If the user exists, update their username if it's missing
        if (!user.username && username) {
            user.username = username;
            await user.save();
        }
    }

    // Send the user data including referralCount and other relevant information
    res.json({
        coins: user.coins,
        clicks: user.clicks,
        level: user.level,
        experience: user.experience,
        lastDailyClaim: user.lastDailyClaim ? user.lastDailyClaim : null,  // If lastDailyClaim exists, send it
        powerUps: user.powerUps,
        doubleClick: user.doubleClick,
        autoClick: user.autoClick,
        clickPower: user.clickPower,
        referralCount: user.referralCount  // Send the referral count to the frontend
    });
});

app.get("/referralCount", async (req, res) => {
    const { telegramId } = req.query;

    // telegramId kontrolü
    if (!telegramId) {
        return res.status(400).json({ message: "telegramId is required" });
    }

    try {
        // Kullanıcıyı referans olarak belirleyen kullanıcı sayısını al
        const count = await User.countDocuments({ referrer: telegramId });

        // Referans sayısını döndür
        res.json({ count });
    } catch (err) {
        // Veritabanı hatası durumunda hata mesajı döndür
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

app.post("/click", async (req, res) => {
    const { telegramId } = req.body;

    if (!telegramId) return res.status(400).json({ message: "telegramId is required" });

    let user = await User.findOne({ telegramId });
    if (!user) {
        user = new User({ telegramId });
        await user.save();
    }

    if (user.clicks <= 0) return res.status(400).json({ message: "Your clicks will be replenished in 20 minutes." });

    let coinEarned = user.clickPower;

    // Eğer autoClick varsa, ek coin eklenir
    if (user.autoClick) {
        coinEarned += 10;
    }

    // Coin değerini güncelliyoruz
    user.coins += coinEarned;
    user.clicks -= 1;
    user.totalClicks += 1;
    user.lastClickTime = new Date();

    // Veritabanını güncelledikten sonra doğru verileri frontend'e gönderiyoruz
    await user.save();

    res.json({
        message: "Click registered",
        coinsEarned: coinEarned,        // Kazanılan coin miktarı
        remainingClicks: user.clicks,   // Kalan tıklama hakkı
        totalCoins: user.coins         // Güncellenmiş toplam coin
    });
});

app.post("/checkDailyReward", async (req, res) => {
    const { telegramId } = req.body;

    if (!telegramId) {
        return res.status(400).json({ message: "telegramId is required" });
    }

    let user = await User.findOne({ telegramId });
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    // Daily reward task için 24 saatlik zaman kontrolü
    const now = new Date();
    const lastClaimed = new Date(user.lastDailyClaim);
    const timeDiff = now - lastClaimed;
    const twentyFourHoursInMs = 24 * 60 * 60 * 1000; // 24 saat

    if (timeDiff < twentyFourHoursInMs) {
        const remainingTime = twentyFourHoursInMs - timeDiff;
        const hours = Math.floor(remainingTime / 3600000);  // Kalan saat
        const minutes = Math.floor((remainingTime % 3600000) / 60000);  // Kalan dakika

        return res.status(400).json({
            message: `⏳ You can claim the daily reward in ${hours}h ${minutes}m.`
        });
    }

    // Eğer 24 saatten fazla süre geçmişse, ödülünü alabilir ve lastDailyClaim'i güncelle
    user.lastDailyClaim = now;  // Son ödül alınma tarihini güncelle
    await user.save();

    res.json({ message: "You can claim the daily reward now." });
});

app.post("/completeTask", async (req, res) => {
    const { telegramId, taskType } = req.body;

    if (!telegramId || !taskType) {
        return res.status(400).json({ message: "telegramId and taskType are required" });
    }

    let user = await User.findOne({ telegramId });
    if (!user) {
        user = new User({ telegramId });
        await user.save();
        console.log("🆕 New user created:", user);  // Yeni kullanıcı oluşturuluyor
    }

    // Görev daha önce tamamlanmış mı kontrol et
    if (user.completedTasks.includes(taskType)) {
        console.log(`Task ${taskType} already completed`);
        return res.status(400).json({ message: "This task has already been completed." });
    }

    const taskRewards = {
        "start_party_with_memex": { xp: 200, coins: 4000 },
        "twitter_follow": { xp: 200, coins: 4000 },
        "telegram_join": { xp: 300, coins: 6000 },
        "twitter_like": { xp: 200, coins: 4000 },
        "twitter_retweet": { xp: 170, coins: 3400 },
        "daily_reward": { xp: 250, coins: 5000 },
        "invite_5_friends": { xp: 250, coins: 5000 },
        "invite_10_friends": { xp: 500, coins: 10000 },
        "invite_20_friends": { xp: 1000, coins: 20000 }
    };

    const reward = taskRewards[taskType];
    if (!reward) {
        console.log(`Invalid task type: ${taskType}`);
        return res.status(400).json({ message: "Invalid task type" });
    }

    console.log(`Reward for ${taskType}:`, reward);

    // Invite görevleri için kontrol ekleme
    if (taskType.startsWith("invite_")) {
        let requiredReferrals = 0;

        if (taskType === "invite_5_friends") {
            requiredReferrals = 5;
        } else if (taskType === "invite_10_friends") {
            requiredReferrals = 10;
        } else if (taskType === "invite_20_friends") {
            requiredReferrals = 20;
        }

        if (user.referrals < requiredReferrals) {
            return res.status(400).json({ message: `⏳ You need to invite ${requiredReferrals} friends to complete this task.` });
        }
    }

    // Daily reward task için 24 saatlik zaman kontrolü
    if (taskType === "daily_reward") {
        const now = new Date();
        const lastClaimed = new Date(user.lastDailyClaim);
        const timeDiff = now - lastClaimed;
        const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

        if (timeDiff < twentyFourHoursInMs) {
            const remainingTime = twentyFourHoursInMs - timeDiff;
            const hours = Math.floor(remainingTime / 3600000);
            const minutes = Math.floor((remainingTime % 3600000) / 60000);
            return res.status(400).json({
                message: `⏳ You can claim the daily reward in ${hours}h ${minutes}m.`
            });
        }

        user.lastDailyClaim = now;  // Son claim zamanını güncelle
    }

    // Coin ve XP güncellemesi
    user.experience += reward.xp;
    user.coins += reward.coins;

    // Tamamlanan görevi kaydet
    user.completedTasks.push(taskType);
    console.log("Completed tasks:", user.completedTasks);

    checkLevelUp(user);
    await user.save();

    res.json({
        message: "✅ Task completed",
        xp: user.experience,
        coins: user.coins,
        level: user.level
    });
});

app.post("/withdraw", async (req, res) => {
    const { telegramId, address } = req.body;
    if (!telegramId || !address) {
        return res.status(400).json({ message: "telegramId and address required" });
    }

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.coins < 1000000) {
        return res.status(400).json({ message: "Minimum 1,000,000 MemeX required." });
    }

    user.coins -= 1000000;
    await user.save();

    res.json({ message: "✅ Withdrawal request received!" });
});

app.post("/buyUpgrade", async (req, res) => {
    const { telegramId, upgradeType } = req.body;
    if (!telegramId || !upgradeType) {
        return res.status(400).json({ message: "telegramId and upgradeType required" });
    }

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const upgrades = {
        "click_power": { cost: 15000, boost: 10 },
        "click_max": { cost: 20000, amount: 50 },
    };

    const selected = upgrades[upgradeType];
    if (!selected) {
        return res.status(400).json({ message: "Invalid upgrade type" });
    }

    if (user.coins < selected.cost) {
        return res.status(400).json({ message: "Not enough coins for upgrade" });
    }

    console.log("Before update:", user);  // Log before update
    user.coins -= selected.cost;
    console.log("After update:", user);   // Log after update

    if (upgradeType === "click_power") {
        user.clickPower += selected.boost;  // +10 Click Power
    } else if (upgradeType === "click_max") {
        user.clicks += selected.amount;  // +50 Max Clicks
    }

    await user.save();

    console.log("User after save:", user);  // Log after save

    res.json({
        message: "✅ Upgrade purchased!",
        coins: user.coins,
        clickPower: user.clickPower,
        clicksLeft: user.clicks  // Ensure clicksLeft is sent
    });
});

cron.schedule("*/20 * * * *", async () => {
    await User.updateMany({}, { $set: { clicks: 100 } });
    console.log("🔁 Clicks refilled.");
});

app.get("/", (req, res) => {
    res.send("✅ MemeX Mini App is live and running!");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});





































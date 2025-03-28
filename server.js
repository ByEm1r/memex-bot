const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect("mongodb+srv://memexuser:91gXsrYvhGjxGo9N@cluster0.05nght9.mongodb.net/memex?retryWrites=true&w=majority&appName=Cluster0");

const UserSchema = new mongoose.Schema({
    telegramId: { type: String, unique: true },
    coins: { type: Number, default: 0 },
    clicks: { type: Number, default: 100 },
    lastClickTime: { type: Date, default: null },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    powerUps: { type: Array, default: [] },
    lastDailyClaim: { type: Date, default: null },
});

const User = mongoose.model("User", UserSchema);

const levelThresholds = [0, 1000, 3000, 6000, 10000, 15000, 21000, 30000, 42000, 55000];
const levelRewards = [0, 500, 1000, 2000, 3000, 5000, 8000, 12000, 17000, 25000];

function checkLevelUp(user) {
    while (user.level < levelThresholds.length && user.experience >= levelThresholds[user.level]) {
        user.level += 1;
        user.coins += levelRewards[user.level];
    }
}

app.get("/getUserData", async (req, res) => {
    const { telegramId } = req.query;
    if (!telegramId) return res.status(400).json({ message: "telegramId is required" });

    let user = await User.findOne({ telegramId });
    if (!user) {
        user = new User({ telegramId });
        await user.save();
    }

    res.json({
        coins: user.coins,
        clicks: user.clicks,
        level: user.level,
        experience: user.experience,
        lastDailyClaim: user.lastDailyClaim,
    });
});

app.post("/click", async (req, res) => {
    try {
        const { telegramId } = req.body;
        if (!telegramId) return res.status(400).json({ message: "telegramId is required" });

        let user = await User.findOne({ telegramId });
        if (!user) {
            user = new User({ telegramId });
            await user.save();
        }

        if (user.clicks <= 0) return res.status(400).json({ message: "No clicks left. Please wait for automatic recharge." });

        const coinEarned = 20;
        user.coins += coinEarned;
        user.clicks -= 1;
        user.totalClicks += 1;
        user.lastClickTime = new Date();

        await user.save();
        res.json({ message: "Click registered", coinsEarned: coinEarned, remainingClicks: user.clicks });
    } catch (error) {
        console.error("/click endpoint error:", error);
        res.status(500).json({ message: "Server error: Click failed." });
    }
});

app.post("/completeTask", async (req, res) => {
    const { telegramId, taskType } = req.body;
    if (!telegramId || !taskType) return res.status(400).json({ message: "telegramId and taskType are required" });

    let user = await User.findOne({ telegramId });
    if (!user) {
        user = new User({ telegramId });
        await user.save();
    }

    const taskRewards = {
        "twitter_follow": { xp: 100, coins: 2000 },
        "telegram_join": { xp: 150, coins: 3000 },
        "twitter_like": { xp: 100, coins: 2000 },
        "twitter_retweet": { xp: 120, coins: 2400 },
        "daily_reward": { xp: 50, coins: 1000 },
    };

    if (!taskRewards[taskType]) return res.status(400).json({ message: "Invalid task type" });

    const delay = taskType === "daily_reward" ? 3000 : 30000;

    setTimeout(async () => {
        user.experience += taskRewards[taskType].xp;
        user.coins += taskRewards[taskType].coins;

        if (taskType === "daily_reward") {
            user.lastDailyClaim = new Date(); // 🔧 Güncellenen kritik satır!
        }

        checkLevelUp(user);
        await user.save();
    }, delay);

    res.json({ message: `Task will be rewarded in ${delay / 1000} seconds.` });
});

app.post("/withdraw", async (req, res) => {
    const { telegramId, address } = req.body;

    if (!telegramId || !address) {
        return res.status(400).json({ message: "telegramId and address required" });
    }

    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.coins < 500000) {
        return res.status(400).json({ message: "Minimum withdrawal is 500,000 MemeX." });
    }

    user.coins -= 500000;
    await user.save();

    res.json({ message: "✅ Withdrawal request received!" });
});

app.get("/leaderboard", async (req, res) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({ lastClickTime: { $gte: since } }).sort({ coins: -1 }).limit(10);

    const leaderboard = users.map((user, index) => {
        const colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
        const icons = ["🥇", "🥈", "🥉"];
        return {
            rank: index + 1,
            rankIcon: icons[index] || "🏅",
            rankColor: colors[index] || "#FFFFFF",
            telegramId: user.telegramId,
            coins: user.coins,
        };
    });

    res.json(leaderboard);
});

// Tıklama hakkı yenileme (20 dakikada bir)
cron.schedule("*/20 * * * *", async () => {
    await User.updateMany({}, { $set: { clicks: 100 } });
    console.log("🔁 Clicks recharged.");
});

// Power-up temizleme (10 dakikada bir)
cron.schedule("*/10 * * * *", async () => {
    await User.updateMany({}, { $pull: { powerUps: { expiresAt: { $lt: Date.now() } } } });
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));









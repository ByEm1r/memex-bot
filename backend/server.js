require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI);

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
    referrer: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
    doubleClick: { type: Boolean, default: false },
    autoClick: { type: Boolean, default: false },
    clickPower: { type: Number, default: 50 }
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
    const { telegramId, ref } = req.query;
    if (!telegramId) return res.status(400).json({ message: "telegramId is required" });

    let user = await User.findOne({ telegramId });

    if (!user) {
        user = new User({ telegramId });

        if (ref && ref !== telegramId) {
            const referrer = await User.findOne({ telegramId: ref });
            if (referrer) {
                user.referrer = ref;
                referrer.coins += 5000;
                referrer.experience += 250;
                referrer.referralCount += 1;
                checkLevelUp(referrer);
                await referrer.save();
            }
        }

        await user.save();
    }

    res.json({
        coins: user.coins,
        clicks: user.clicks,
        level: user.level,
        experience: user.experience,
        lastDailyClaim: user.lastDailyClaim,
        powerUps: user.powerUps,
        doubleClick: user.doubleClick,
        autoClick: user.autoClick,
        clickPower: user.clickPower,
        referralCount: user.referralCount
    });
});

app.get("/referralCount", async (req, res) => {
    const { telegramId } = req.query;
    if (!telegramId) return res.status(400).json({ message: "telegramId is required" });

    const count = await User.countDocuments({ referrer: telegramId });
    res.json({ count });
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

    if (user.doubleClick) {
        coinEarned *= 2;
    }

    if (user.autoClick) {
        coinEarned += 10;
    }

    user.coins += coinEarned;
    user.clicks -= 1;
    user.totalClicks += 1;
    user.lastClickTime = new Date();

    await user.save();
    res.json({ message: "Click registered", coinsEarned: coinEarned, remainingClicks: user.clicks });
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
    }

    const taskRewards = {
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
        return res.status(400).json({ message: "Invalid task type" });
    }

    user.experience += reward.xp;
    user.coins += reward.coins;

    if (taskType === "invite_5_friends" || taskType === "invite_10_friends" || taskType === "invite_20_friends") {
        user.referralCount += 1;
    }

    if (taskType === "daily_reward") {
        user.lastDailyClaim = new Date();
    }

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

    if (user.coins < 500000) {
        return res.status(400).json({ message: "Minimum 500,000 MemeX required." });
    }

    user.coins -= 500000;
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
        "click_power": { cost: 8000, boost: 10 },
        "click_max": { cost: 20000, amount: 50 },
        "double_click": { cost: 20000, duration: 30 * 60 * 1000 },
        "auto_click": { cost: 15000, duration: 60 * 60 * 1000 },
    };

    const selected = upgrades[upgradeType];
    if (!selected || user.coins < selected.cost) {
        return res.status(400).json({ message: "Not enough coins or invalid upgrade." });
    }

    user.coins -= selected.cost;

    if (upgradeType === "click_power") {
        user.clickPower += selected.boost;
    }

    if (upgradeType === "click_max") {
        user.clicks += selected.amount;
    }

    if (upgradeType === "double_click") {
        user.doubleClick = true;
        user.doubleClickExpiration = new Date().getTime() + selected.duration;
    }

    if (upgradeType === "auto_click") {
        user.autoClick = true;
        user.autoClickExpiration = new Date().getTime() + selected.duration;
    }

    await user.save();
    res.json({ message: "✅ Upgrade purchased!", coins: user.coins, clickPower: user.clickPower });
});

app.get("/leaderboard", async (req, res) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({ lastClickTime: { $gte: since } }).sort({ coins: -1 }).limit(10);

    const leaderboard = users.map((user, index) => {
        const icons = ["🥇", "🥈", "🥉"];
        return {
            rank: index + 1,
            icon: icons[index] || "🏅",
            telegramId: user.telegramId,
            coins: user.coins,
            level: user.level
        };
    });

    res.json(leaderboard);
});

cron.schedule("*/20 * * * *", async () => {
    await User.updateMany({}, { $set: { clicks: 100 } });
    console.log("🔁 Clicks refilled.");
});

app.get("/", (req, res) => {
    res.send("✅ MemeX Mini App is live and running!");
});

app.listen(3001, () => {
    console.log("✅ Server running on http://localhost:3001");
});
























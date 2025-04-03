import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

axios.defaults.baseURL = "https://memex-server.onrender.com";

function App() {
    const [telegramId, setTelegramId] = useState(null);
    const [coins, setCoins] = useState(0);
    const [clicksLeft, setClicksLeft] = useState(0);
    const [level, setLevel] = useState(1);
    const [clickPower, setClickPower] = useState(50);
    const [lastDailyClaim, setLastDailyClaim] = useState(null);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [referralCount, setReferralCount] = useState(0);
    const [activeTab, setActiveTab] = useState("home");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false); // loading durumunu tanımladık
    const [loadingTaskId, setLoadingTaskId] = useState(null);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [withdrawAddress, setWithdrawAddress] = useState("");
    const [marketItems] = useState([
        { id: "click_power", label: "⚡ +10 Click Power", price: 8000 },
        { id: "click_max", label: "🔋 +50 Max Clicks", price: 20000 },
        { id: "double_click", label: "🌀 2x Click Reward (30 min)", price: 20000 },
        { id: "auto_click", label: "🤖 Auto-Clicker (1 hour)", price: 15000 }
    ]);

    const restrictedReferralTasks = {
        invite_5_friends: 5,
        invite_10_friends: 10,
        invite_20_friends: 20
    };

    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(""), 5000);
    };

    const handleClick = async () => {
        if (loading) return; // Eğer önceki işlem devam ediyorsa, yeni işlem yapılmasın.
        setLoading(true);  // Yükleme başlatıyoruz

        try {
            const res = await axios.post("/click", { telegramId });
            setCoins(prev => prev + res.data.coinsEarned);
            setClicksLeft(res.data.remainingClicks);
            showMessage(`+${res.data.coinsEarned} 💰`);
        } catch (err) {
            showMessage(err.response?.data?.message || "❌ Click failed");
        } finally {
            setLoading(false);  // Yükleme tamamlanınca flag'i resetliyoruz
        }
    };

    const handleTaskClick = async (taskId, link) => {
        if (completedTasks.includes(taskId)) return;
        setLoadingTaskId(taskId);

        if (restrictedReferralTasks[taskId] && referralCount < restrictedReferralTasks[taskId]) {
            showMessage(`❌ You need at least ${restrictedReferralTasks[taskId]} referrals to complete this task.`);
            setLoadingTaskId(null);
            return;
        }

        if (taskId === "daily_reward") {
            const now = new Date();
            const last = new Date(lastDailyClaim);
            const diff = now - last;
            if (lastDailyClaim && diff < 86400000) {
                const remaining = 86400000 - diff;
                const hours = Math.floor(remaining / 3600000);
                const minutes = Math.floor((remaining % 3600000) / 60000);
                showMessage(`⏳ Come back in ${hours}h ${minutes}m`);
                setLoadingTaskId(null);
                return;
            }
            await new Promise((r) => setTimeout(r, 3000));
        } else {
            window.open(link, "_blank");
            await new Promise((r) => setTimeout(r, 30000));
        }

        try {
            const res = await axios.post("/completeTask", { telegramId, taskType: taskId });
            const updated = [...completedTasks, taskId];
            setCompletedTasks(updated);
            localStorage.setItem("completedTasks", JSON.stringify(updated));
            setCoins(res.data.coins);
            setLevel(res.data.level);
            showMessage("✅ Task completed!");
        } catch (err) {
            showMessage("❌ Task failed!");
        } finally {
            setLoadingTaskId(null);
        }
    };

    const handleWithdraw = async () => {
        if (coins < 500000) {
            showMessage("❌ Minimum 500,000 MemeX required to withdraw.");
            return;
        }
        if (!withdrawAddress) {
            showMessage("❌ Please enter your wallet address.");
            return;
        }
        try {
            await axios.post("/withdraw", { telegramId, address: withdrawAddress });
            setCoins(prev => prev - 500000);
            showMessage("✅ Withdrawal requested!");
        } catch (err) {
            showMessage("❌ Withdrawal failed.");
        }
    };

    const handleBuyUpgrade = async (type) => {
        try {
            const res = await axios.post("/buyUpgrade", { telegramId, upgradeType: type });
            setCoins(res.data.coins);
            if (res.data.clickPower) setClickPower(res.data.clickPower);
            showMessage("✅ Upgrade purchased!");
        } catch (error) {
            showMessage("❌ " + (error.response?.data?.message || "Upgrade failed"));
        }
    };

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        const userId = tg?.initDataUnsafe?.user?.id;
        const ref = tg?.initDataUnsafe?.start_param?.replace("ref_", "");

        if (userId) {
            setTelegramId(userId.toString());
            localStorage.setItem("referrer", ref || "");
        } else {
            setTelegramId("123456789");
        }
        tg?.expand();
    }, []);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const ref = localStorage.getItem("referrer");
                const res = await axios.get(`/getUserData?telegramId=${telegramId}${ref ? `&ref=${ref}` : ""}`);
                setCoins(res.data.coins);
                setClicksLeft(res.data.clicks);
                setLevel(res.data.level);
                setClickPower(res.data.clickPower);
                setLastDailyClaim(res.data.lastDailyClaim);
            } catch (err) {
                console.error("User data error:", err);
            }
        };

        const fetchLeaderboardData = async () => {
            try {
                const res = await axios.get("/leaderboard");
                setLeaderboardData(res.data); // Leaderboard verilerini buradan güncelliyoruz
            } catch (err) {
                console.error("Leaderboard fetch error:", err);
            }
        };

        const fetchReferralCount = async () => {
            try {
                const res = await axios.get(`/referralCount?telegramId=${telegramId}`);
                setReferralCount(res.data.count);
            } catch (err) {
                console.error("Referral count error:", err);
            }
        };

        if (telegramId) {
            fetchUserData();
            fetchLeaderboardData(); // Liderlik tablosu verisini alıyoruz
            fetchReferralCount();
        }
    }, [telegramId]);

    return (
        <div className="App">
            <div className="top-bar">
                <div className="coins">💰 {coins.toLocaleString()}</div>
                <div className="level">⭐ Level {level}</div>
                <div className="withdraw">
                    <input
                        type="text"
                        placeholder="Wallet address"
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                    />
                    <button onClick={handleWithdraw}>💸 Withdraw</button>
                </div>
            </div>

            {activeTab === "home" && (
                <>
                    <div className="emoji-container">
                        <img src="emoji.png" alt="emoji" onClick={handleClick} />
                    </div>
                    <div className="click-bar-container">
                        <div className="click-bar">
                            <div className="click-bar-fill" style={{ width: `${(clicksLeft / 100) * 100}%` }}></div>
                        </div>
                        <div className="click-info">{clicksLeft}/100</div>
                        <div className="click-note">Each click earns {clickPower} points</div>
                    </div>
                </>
            )}

            {activeTab === "tasks" && (
                <div className="task-list">
                    {[
                        { id: "twitter_follow", title: "Follow on X", link: "https://x.com/memexairdrop", reward: "4,000 💰 / 200 XP" },
                        { id: "telegram_join", title: "Join Telegram", link: "https://t.me/MemeXGloball", reward: "6,000 💰 / 300 XP" },
                        { id: "twitter_like", title: "Like Tweet", link: "https://x.com/memexairdrop/status/1904244723469984157", reward: "4,000 💰 / 200 XP" },
                        { id: "twitter_retweet", title: "Retweet Tweet", link: "https://x.com/memexairdrop/status/1904244723469984157", reward: "3,400 💰 / 170 XP" },
                        { id: "daily_reward", title: "Claim Daily Reward", link: "#", reward: "5,000 💰 / 250 XP" },
                        { id: "invite_5_friends", title: "Invite 5 Friends", link: "#", reward: "5,000 💰 / 250 XP" },
                        { id: "invite_10_friends", title: "Invite 10 Friends", link: "#", reward: "10,000 💰 / 500 XP" },
                        { id: "invite_20_friends", title: "Invite 20 Friends", link: "#", reward: "20,000 💰 / 1000 XP" }
                    ].map((task) => (
                        <div key={task.id} className={`task-card ${completedTasks.includes(task.id) ? "completed" : ""}`}>
                            <div>{task.title}</div>
                            <div>{task.reward}</div>
                            <button onClick={() => handleTaskClick(task.id, task.link)}>
                                {completedTasks.includes(task.id) ? "✅ Completed" : loadingTaskId === task.id ? "Loading..." : "Do Task"}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "leaderboard" && (
                <div className="leaderboard">
                    <p>🏆 Leaderboard resets daily</p>
                    {leaderboardData.map((user) => (
                        <div key={user.telegramId} className="leaderboard-item">
                            {user.icon} #{user.rank} - {user.telegramId} - 💰 {user.coins.toLocaleString()} - ⭐ Level {user.level}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "referral" && telegramId && (
                <div className="referral">
                    <h3>🔗 Referral</h3>
                    <p>Invite your friends and earn 5,000 💰 + 250 XP for each!</p>
                    <p>👥 Referrals: {referralCount}</p>
                    <p>Share this link:</p>
                    <code>{`https://t.me/MemexGamebot?start=ref_${telegramId}`}</code>
                </div>
            )}

            {activeTab === "market" && (
                <div className="market">
                    <h3>🛒 Market</h3>
                    {marketItems.map((item) => (
                        <div key={item.id} className="upgrade-card">
                            <p>{item.label} ({item.price.toLocaleString()} 💰)</p>
                            <button onClick={() => handleBuyUpgrade(item.id)}>Buy</button>
                        </div>
                    ))}
                </div>
            )}

            <div className="tabs">
                <button onClick={() => setActiveTab("home")}>🏠 Home</button>
                <button onClick={() => setActiveTab("tasks")}>🧩 Tasks</button>
                <button onClick={() => setActiveTab("leaderboard")}>📊 Leaderboard</button>
                <button onClick={() => setActiveTab("referral")}>🔗 Referral</button>
                <button onClick={() => setActiveTab("market")}>🛒 Market</button>
            </div>

            {message && <div className="message-box">{message}</div>}
        </div>
    );
}

export default App;

















































































import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
    const [coins, setCoins] = useState(0);
    const [clicksLeft, setClicksLeft] = useState(0);
    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState("home");
    const [loading, setLoading] = useState(false);
    const [loadingTaskId, setLoadingTaskId] = useState(null);
    const [level, setLevel] = useState(1);
    const [xp, setXp] = useState(0);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [withdrawAddress, setWithdrawAddress] = useState("");
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [lastDailyClaim, setLastDailyClaim] = useState(null);
    const telegramId = "123456789";

    const levelThresholds = [0, 1000, 3000, 6000, 10000, 15000];

    useEffect(() => {
        fetchUserData();
        const savedTasks = JSON.parse(localStorage.getItem("completedTasks")) || [];
        setCompletedTasks(savedTasks);
    }, []);

    const fetchUserData = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/getUserData?telegramId=${telegramId}`);
            setCoins(res.data.coins);
            setClicksLeft(res.data.clicks);
            setLevel(res.data.level);
            setXp(res.data.experience);
            setLastDailyClaim(res.data.lastDailyClaim);
        } catch (err) {
            console.error("Failed to fetch user data", err);
        }
    };

    const handleClick = async () => {
        if (loading) return;

        if (clicksLeft <= 0) {
            if (!message) {
                setMessage("❌ No clicks left. Please wait for automatic recharge.");
                setTimeout(() => setMessage(""), 3000);
            }
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post("http://localhost:5000/click", { telegramId });
            setCoins((prev) => prev + res.data.coinsEarned);
            setClicksLeft(res.data.remainingClicks);
            setMessage(""); // varsa eski mesajı temizle
        } catch (error) {
            console.error("Click error:", error);
            setMessage("❌ Error occurred while clicking.");
            setTimeout(() => setMessage(""), 3000);
        } finally {
            setLoading(false);
        }
    };

    const taskList = [
        { id: "twitter_follow", title: "Follow on X", link: "https://x.com/memexairdrop", reward: "2,000 💰 / 100 XP" },
        { id: "telegram_join", title: "Join Telegram", link: "https://t.me/MemeXGloball", reward: "3,000 💰 / 150 XP" },
        { id: "twitter_like", title: "Like Tweet", link: "https://x.com/memexairdrop/status/1904244723469984157", reward: "2,000 💰 / 100 XP" },
        { id: "twitter_retweet", title: "Retweet Tweet", link: "https://x.com/memexairdrop/status/1904244723469984157", reward: "2,400 💰 / 120 XP" },
        { id: "daily_reward", title: "Claim Daily Reward", link: "#", reward: "1,000 💰 / 50 XP" }
    ];

    const handleTaskClick = async (taskId, link) => {
        if (completedTasks.includes(taskId)) {
            setMessage("❌ Task already completed!");
            setTimeout(() => setMessage(""), 3000);
            return;
        }

        setLoadingTaskId(taskId);

        if (taskId === "daily_reward") {
            const now = new Date();
            const lastClaim = new Date(lastDailyClaim);
            const diff = now - lastClaim;
            const oneDay = 24 * 60 * 60 * 1000;

            if (lastDailyClaim && diff < oneDay) {
                setMessage("✅ Already claimed today!");
                setTimeout(() => setMessage(""), 3000);
                setLoadingTaskId(null);
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
            window.open(link, "_blank");
            await new Promise((resolve) => setTimeout(resolve, 30000));
        }

        try {
            await axios.post("http://localhost:5000/completeTask", {
                telegramId,
                taskType: taskId
            });

            const updated = [...completedTasks, taskId];
            setCompletedTasks(updated);
            localStorage.setItem("completedTasks", JSON.stringify(updated));
            setMessage("✅ Task completed!");

            const delay = taskId === "daily_reward" ? 3000 : 30000;
            setTimeout(() => {
                fetchUserData();
            }, delay);
        } catch (error) {
            console.error("Task error:", error);
            setMessage("❌ Task failed!");
        } finally {
            setLoadingTaskId(null);
            setTimeout(() => setMessage(""), 3000);
        }
    };

    return (
        <div className="App">
            {activeTab === "home" && (
                <>
                    <div className="top-bar">
                        <div className="coins">💰 {coins.toLocaleString()}</div>
                        <div className="level-container">
                            ⭐ Level {level}
                            <div className="xp-bar">
                                <div
                                    className="xp-fill"
                                    style={{
                                        width: `${Math.min(
                                            100,
                                            ((xp - levelThresholds[level - 1]) / (levelThresholds[level] - levelThresholds[level - 1])) * 100
                                        )}%`
                                    }}
                                ></div>
                            </div>
                        </div>
                        <button className="withdraw-btn" onClick={() => setShowWithdraw(!showWithdraw)}>Withdraw</button>
                    </div>

                    {showWithdraw && (
                        <div className="withdraw-popup">
                            <input
                                type="text"
                                placeholder="Enter wallet address"
                                value={withdrawAddress}
                                onChange={(e) => setWithdrawAddress(e.target.value)}
                            />
                            <button
                                onClick={async () => {
                                    if (coins < 500000) {
                                        setMessage("❌ Minimum 500,000 MemeX required to withdraw.");
                                        setTimeout(() => setMessage(""), 3000);
                                        return;
                                    }
                                    await axios.post("http://localhost:5000/withdraw", {
                                        telegramId,
                                        address: withdrawAddress
                                    });
                                    setMessage("✅ Withdrawal request sent!");
                                    setTimeout(() => setMessage(""), 3000);
                                    setWithdrawAddress("");
                                    setShowWithdraw(false);
                                }}
                            >
                                Send
                            </button>
                        </div>
                    )}

                    <div className="emoji-container">
                        <img src="emoji.png" alt="emoji" className="emoji" onClick={handleClick} />
                    </div>

                    <div className="click-bar-container">
                        <div className="click-bar">
                            <div className="click-bar-fill" style={{ width: `${(clicksLeft / 100) * 100}%` }}></div>
                        </div>
                        <div className="click-info">{clicksLeft}/100</div>
                        <div className="click-note">Each click earns 20 points</div>
                    </div>
                </>
            )}

            {activeTab === "tasks" && (
                <div className="task-list">
                    {taskList.map((task) => (
                        <div key={task.id} className={`task-card ${completedTasks.includes(task.id) ? "completed" : ""}`}>
                            <div className="task-title">{task.title}</div>
                            <div className="task-reward">{task.reward}</div>
                            <button
                                disabled={completedTasks.includes(task.id)}
                                onClick={() => handleTaskClick(task.id, task.link)}
                            >
                                {completedTasks.includes(task.id) ? "✅ Completed" : loadingTaskId === task.id ? "Loading..." : "Do Task"}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === "leaderboard" && (
                <div className="leaderboard">
                    <p>🏆 Leaderboard resets daily</p>
                    {/* Leaderboard data will go here */}
                </div>
            )}

            <div className="tabs">
                <button onClick={() => setActiveTab("home")}>🏠 Home</button>
                <button onClick={() => setActiveTab("tasks")}>🧩 Tasks</button>
                <button onClick={() => setActiveTab("leaderboard")}>📊 Leaderboard</button>
            </div>

            {message && <div className="message-box">{message}</div>}
        </div>
    );
}

export default App;





















































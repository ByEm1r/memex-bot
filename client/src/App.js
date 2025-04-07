import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

axios.defaults.baseURL = "https://memex-server.onrender.com";

// Backend'e veri göndermek için createUser fonksiyonunu tanımlıyoruz
const createUser = async (userData) => {
    try {
        const response = await axios.post('/createUser', userData);
        console.log("User created successfully:", response.data);
    } catch (error) {
        console.error("Error creating user:", error);
    }
};

function App() {
    const [telegramId, setTelegramId] = useState(null);
    const [username, setUsername] = useState("");
    const [coins, setCoins] = useState(0);
    const [clicksLeft, setClicksLeft] = useState(0);
    const [level, setLevel] = useState(1);
    const [clickPower, setClickPower] = useState(50);
    const [lastDailyClaim, setLastDailyClaim] = useState(null);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [referralCount, setReferralCount] = useState(0);
    const [activeTab, setActiveTab] = useState("home");
    const [message, setMessage] = useState("");
    const [loadingTaskId, setLoadingTaskId] = useState(null);
    const [withdrawAddress, setWithdrawAddress] = useState("");
    const [withdrawVisible, setWithdrawVisible] = useState(false);
    const [lastClickTime, setLastClickTime] = useState(null); // Son tıklama zamanını saklamak için

    const marketItems = [
        { id: "click_power", label: "⚡ +10 Click Power", price: 15000 },
        { id: "click_max", label: "🔋 +50 Max Clicks", price: 20000 },
    ];

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
        const currentTime = Date.now();

        // Eğer tıklama hakkı yoksa, tıklama bekleme mesajı göster
        if (clicksLeft <= 0) {
            const remainingTime = 1200000 - (currentTime - lastClickTime);
            if (remainingTime > 0) {
                const minutes = Math.floor(remainingTime / 60000);
                showMessage(`⏳ Please wait ${minutes} minutes before you can click again.`);
                return;
            } else {
                setClicksLeft(100); // Tıklama haklarını güncelliyoruz (backend'den gelen verilere göre)
                setLastClickTime(currentTime);
            }
        }

        // 30ms içinde yapılan tıklamalar engelleniyor (hızlı tıklama önleniyor)
        if (currentTime - lastClickTime < 30) {
            return;  // Çok hızlı tıklamalar engelleniyor
        }

        // Son tıklama zamanını güncelliyoruz
        setLastClickTime(currentTime);

        try {
            // Paralel olarak çoklu tıklama istekleri gönderiyoruz
            const res = await axios.post("/click", { telegramId: telegramId });

            // Gelen coin ve kalan tıklama bilgilerini işliyoruz
            if (res.data.coinsEarned) {
                setCoins((prevCoins) => prevCoins + res.data.coinsEarned);  // Coin'leri birleştiriyoruz
            }

            if (res.data.remainingClicks) {
                setClicksLeft(res.data.remainingClicks);  // Kalan tıklama hakkını güncelliyoruz
            }

            showMessage(`+${res.data.coinsEarned} 💰`);  // Kazanç bilgisi gösteriliyor

            // **Backend'den tekrar coin verilerini alıyoruz** ve UI'yi senkronize ediyoruz
            const coinRes = await axios.get(`/getUserData?telegramId=${telegramId}`);
            setCoins(coinRes.data.coins); // Backend'den alınan doğru coin miktarı ile güncelliyoruz

        } catch (err) {
            showMessage(err.response?.data?.message || "❌ Click failed");
        }
    };

    const handleTaskClick = async (taskId, link) => {
        console.log("Task ID:", taskId);

        // Eğer görev daha önce tamamlanmışsa, tekrar yapılmasına izin verme
        if (completedTasks.includes(taskId)) {
            console.log(`Task ${taskId} already completed`);
            return;
        }

        setLoadingTaskId(taskId);

        // Referral görevleri için şartları kontrol et
        if (restrictedReferralTasks[taskId]) {
            const requiredReferrals = restrictedReferralTasks[taskId];
            if (referralCount < requiredReferrals) {
                showMessage(`❌ You need at least ${requiredReferrals} referrals to complete this task.`);
                setLoadingTaskId(null);
                return;
            }
        }

        // "daily_reward" görevi için, lastDailyClaim üzerinden 24 saatlik zaman kontrolü
        if (taskId === "daily_reward") {
            if (lastDailyClaim) {
                const now = new Date();
                const diff = now - new Date(lastDailyClaim);  // lastDailyClaim ile şu anki zaman farkını alıyoruz

                const twentyFourHoursInMs = 24 * 60 * 60 * 1000;  // 24 saat = 86400000 ms
                if (diff < twentyFourHoursInMs) {
                    const remainingTime = twentyFourHoursInMs - diff;
                    const hours = Math.floor(remainingTime / 3600000);  // Kalan saat
                    const minutes = Math.floor((remainingTime % 3600000) / 60000);  // Kalan dakika

                    showMessage(`⏳ You can claim the daily reward in ${hours}h ${minutes}m.`);  // Kalan süreyi gösteriyoruz
                    setLoadingTaskId(null);
                    return;  // Eğer süre bitmemişse, işlemi durduruyoruz
                }
            }
            // Eğer süre bitmişse, görevi tamamla
            await new Promise((r) => setTimeout(r, 3000));  // 3 saniye bekle
        } else if (taskId === "start_party_with_memex" || taskId === "twitter_follow" || taskId === "telegram_join" || taskId === "twitter_like" || taskId === "twitter_retweet") {
            window.open(link, "_blank");
            await new Promise((r) => setTimeout(r, 10000)); // 10 saniye bekle
        }

        try {
            const res = await axios.post("/completeTask", { telegramId, taskType: taskId });

            // Görevi tamamladığında, completedTasks dizisine ekle
            const updated = [...completedTasks, taskId];
            setCompletedTasks(updated);

            // Güncel completedTasks dizisini localStorage'a kaydet
            localStorage.setItem("completedTasks", JSON.stringify(updated));

            // Kullanıcı bilgilerini güncelle
            setCoins(res.data.coins);
            setLevel(res.data.level);
            showMessage("✅ Task completed!");
        } catch (err) {
            console.log("Error during task completion:", err);
            showMessage("❌ Task failed!");
        } finally {
            setLoadingTaskId(null);
        }
    };

    const handleWithdraw = async () => {
        if (coins < 1000000) {
            showMessage("❌ Minimum 1,000,000 MemeX required to withdraw.");
            return;
        }
        if (!withdrawAddress) {
            showMessage("❌ Please enter your wallet address.");
            return;
        }
        try {
            await axios.post("/withdraw", { telegramId, address: withdrawAddress });
            setCoins((prev) => prev - 1000000);
            showMessage("✅ Withdrawal requested!");
        } catch (err) {
            showMessage("❌ Withdrawal failed.");
        }
    };

    const handleBuyUpgrade = async (type) => {
        try {
            // Yükseltme işlemini backend'e gönderiyoruz
            const res = await axios.post("/buyUpgrade", { telegramId, upgradeType: type });

            // Backend'den gelen yanıtı kontrol et
            console.log("Response from /buyUpgrade:", res);  // Debugging log

            // Yanıtın olup olmadığını kontrol ediyoruz
            if (!res || !res.data) {
                showMessage("❌ No data returned from server.");
                return;
            }

            // Backend'den gelen doğru veriyi güncelle
            const { coins, clickPower, clicksLeft } = res.data;

            // Coin ve clickPower'ı güncelle
            setCoins(coins); // Backend'den gelen coin değerini güncelle
            console.log("Updated coins:", coins);  // Debugging log

            if (clickPower) {
                setClickPower(clickPower);  // Backend'den gelen clickPower değerini güncelle
                console.log("Updated clickPower:", clickPower);  // Debugging log
            }

            if (clicksLeft) {
                setClicksLeft(clicksLeft);  // Kalan tıklama hakkını güncelle
                console.log("Updated clicksLeft:", clicksLeft);  // Debugging log
            }

            // Başarı mesajı
            showMessage(`✅ Upgrade purchased for ${coins.toLocaleString()} MemeX!`);
        } catch (error) {
            console.error("Upgrade failed with error:", error);
            const errorMessage = error.response?.data?.message || "Upgrade failed";
            showMessage(`❌ ${errorMessage}`);
        }
    };

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        const userId = tg?.initDataUnsafe?.user?.id;
        const ref = tg?.initDataUnsafe?.start_param?.replace("ref_", "");
        const username = tg?.initDataUnsafe?.user?.username;

        if (userId) {
            setTelegramId(userId.toString());
            localStorage.setItem("referrer", ref || "");
            localStorage.setItem("username", username || "Anonymous");
            setUsername(username || "Anonymous");

            const userData = {
                telegramId: userId.toString(),
                username: username || "Anonymous",
                coins: 0,
                clicks: 100,
                level: 1,
                experience: 0,
                totalClicks: 0,
                powerUps: [],
                referrer: ref || null,
                referralCount: 0,
                doubleClick: false,
                autoClick: false,
                clickPower: 50,
            };

            createUser(userData);
        } else {
            setTelegramId("123456789");
        }
        tg?.expand();
        // Burada localStorage'dan tamamlanmış görevleri alıyoruz
        const storedTasks = localStorage.getItem("completedTasks");
        if (storedTasks) {
            setCompletedTasks(JSON.parse(storedTasks));  // localStorage'dan tamamlanmış görevleri yükle
        }
    }, []);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const ref = localStorage.getItem("referrer");
                const res = await axios.get(`/getUserData?telegramId=${telegramId}${ref ? `&ref=${ref}` : ""}&username=${username}`);

                setCoins(res.data.coins);
                setClicksLeft(res.data.clicks);
                setLevel(res.data.level);
                setClickPower(res.data.clickPower);
                setLastDailyClaim(res.data.lastDailyClaim);
            } catch (err) {
                console.error("User data error:", err);
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
            // fetchUserData'yi önce çağırıyoruz
            fetchUserData();
            // fetchReferralCount'ı daha sonra çağırıyoruz
            fetchReferralCount();
        }
    }, [telegramId, username]);  // Bağımlılıklar

    return (
        <div className="App">
            <div className="top-bar">
                <div className="coins">💰 {coins !== undefined && coins !== null ? coins.toLocaleString() : 0}</div>
                <div className="level">⭐ Level {level !== undefined && level !== null ? level : 1}</div>
                <div className="withdraw-btn">
                    <button onClick={() => setWithdrawVisible(!withdrawVisible)}>💸 Withdraw</button>
                </div>
                {withdrawVisible && (
                    <div className="withdraw-popup show">
                        <input
                            type="text"
                            placeholder="Wallet address"
                            value={withdrawAddress}
                            onChange={(e) => setWithdrawAddress(e.target.value)}
                        />
                        <button onClick={handleWithdraw}>Send</button>
                    </div>
                )}
            </div>

            {activeTab === "home" && (
                <>
                    <div className="emoji-container">
                        <img src={`${process.env.PUBLIC_URL}/emoji.png`} alt="emoji" onClick={handleClick} />
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
                        { id: "start_party_with_memex", title: "Start the Party with $MemeX (Like & RT)", link: "https://x.com/memexairdrop/status/1908559188751507763", reward: "4,000 💰 / 200 XP" },
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

            {activeTab === "referral" && telegramId && (
                <div className="referral">
                    <h3>🔗 Referral</h3>
                    <p>👥 Referrals: {referralCount}</p>
                    <p>Share this link:</p>
                    <code>{`https://t.me/MemexGamebot?start=ref_${telegramId}`}</code>
                    <button onClick={() => {
                        navigator.clipboard.writeText(`https://t.me/MemexGamebot?start=ref_${telegramId}`);
                        showMessage("🔗 Referral link copied!");
                    }}>
                        📋 Copy Referral Link
                    </button>
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
                <button onClick={() => setActiveTab("referral")}>🔗 Referral</button>
                <button onClick={() => setActiveTab("market")}>🛒 Market</button>
            </div>

            {message && <div className="message-box">{message}</div>}
        </div>
    );
}

export default App;



































































































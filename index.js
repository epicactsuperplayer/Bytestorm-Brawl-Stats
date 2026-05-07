import Head from "next/head";
import { useState, useEffect, useCallback } from "react";

// ─── helpers ───────────────────────────────────────────────────
function encodeTag(tag) {
  return encodeURIComponent(tag.replace(/^#?/, "#").toUpperCase());
}

async function apiFetch(path) {
  const res = await fetch(`/api/brawl/${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Unknown error");
  return data;
}

const RANK_COLORS = {
  1: "#ff9500",
  2: "#c0c0c0",
  3: "#cd7f32",
};

const TROPHY_RANGES = [
  { min: 0, label: "Bronze", color: "#cd7f32" },
  { min: 500, label: "Silver", color: "#c0c0c0" },
  { min: 1000, label: "Gold", color: "#ffd700" },
  { min: 2000, label: "Diamond", color: "#b9f2ff" },
  { min: 3000, label: "Mythic", color: "#ff6ec7" },
  { min: 5000, label: "Legendary", color: "#ff9500" },
];

function getTrophyTier(trophies) {
  let tier = TROPHY_RANGES[0];
  for (const t of TROPHY_RANGES) {
    if (trophies >= t.min) tier = t;
  }
  return tier;
}

// ─── sub-components ────────────────────────────────────────────
function StatCard({ label, value, icon, accent }) {
  return (
    <div className="stat-card" style={{ "--accent": accent || "var(--yellow)" }}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-body">
        <div className="stat-value">{value ?? "—"}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function BrawlerCard({ b, rank }) {
  const tier = getTrophyTier(b.trophies);
  return (
    <div className="brawler-card" style={{ "--tier-color": tier.color }}>
      <div className="brawler-rank">#{rank}</div>
      <div className="brawler-name">{b.name}</div>
      <div className="brawler-trophies">
        <span className="trophy-icon">🏆</span>
        <span>{b.trophies.toLocaleString()}</span>
      </div>
      <div className="brawler-power">
        <span>Power </span>
        <span className="power-badge">{b.power}</span>
      </div>
      <div className="brawler-tier-badge" style={{ background: tier.color + "33", color: tier.color }}>
        {tier.label}
      </div>
    </div>
  );
}

function BattleItem({ battle }) {
  const b = battle;
  const mode = b.battle?.mode || b.event?.mode || "unknown";
  const result = b.battle?.result || "draw";
  const type = b.battle?.type || "";
  const map = b.event?.map || "Unknown Map";
  const trophyChange = b.battle?.trophyChange;
  const time = new Date(
    b.battleTime.replace(
      /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.\d+Z/,
      "$1-$2-$3T$4:$5:$6Z"
    )
  );

  const resultColor =
    result === "victory" ? "#00e676" : result === "defeat" ? "#ff4d4d" : "#ffb300";
  const modeEmoji = {
    gemgrab: "💎", brawlball: "⚽", heist: "💰", bounty: "⭐",
    siege: "🤖", showdown: "🎯", duoShowdown: "👥", hotzone: "🔥",
    knockout: "🥊", wipeout: "💥", basketbrawl: "🏀", volleybrawl: "🏐",
    payload: "📦", botdrop: "🤖", duels: "⚔️",
  };
  const emoji = modeEmoji[mode] || "🎮";

  return (
    <div className="battle-item" style={{ "--result-color": resultColor }}>
      <div className="battle-mode-icon">{emoji}</div>
      <div className="battle-info">
        <div className="battle-mode-name">{mode.replace(/([A-Z])/g, " $1").trim()}</div>
        <div className="battle-map">{map}</div>
        <div className="battle-time">{time.toLocaleString()}</div>
      </div>
      <div className="battle-result">
        <div className="battle-result-text" style={{ color: resultColor }}>
          {result.toUpperCase()}
        </div>
        {trophyChange !== undefined && trophyChange !== null && (
          <div className="trophy-change" style={{ color: trophyChange >= 0 ? "#00e676" : "#ff4d4d" }}>
            {trophyChange >= 0 ? "+" : ""}
            {trophyChange} 🏆
          </div>
        )}
      </div>
    </div>
  );
}

function ClubCard({ club }) {
  if (!club) return null;
  return (
    <div className="club-card">
      <div className="club-header">
        <span className="club-icon">🛡️</span>
        <div>
          <div className="club-name">{club.name}</div>
          <div className="club-tag">{club.tag}</div>
        </div>
      </div>
      <div className="club-stats">
        <div className="club-stat">
          <span>🏆</span>
          <span>{club.trophies?.toLocaleString()}</span>
        </div>
        <div className="club-stat">
          <span>👥</span>
          <span>{club.members} members</span>
        </div>
        <div className="club-stat">
          <span>🔒</span>
          <span>{club.type || "—"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── main page ─────────────────────────────────────────────────
export default function Home() {
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [player, setPlayer] = useState(null);
  const [battles, setBattles] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const search = useCallback(async (searchTag) => {
    const t = (searchTag || tag).trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    setPlayer(null);
    setBattles(null);
    try {
      const encoded = encodeTag(t);
      const [playerData, battleData] = await Promise.allSettled([
        apiFetch(`players/${encoded}`),
        apiFetch(`players/${encoded}/battlelog`),
      ]);

      if (playerData.status === "rejected") {
        throw new Error(playerData.reason?.message || "Player not found");
      }
      setPlayer(playerData.value);
      if (battleData.status === "fulfilled") {
        setBattles(battleData.value.items || []);
      }
      setActiveTab("overview");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  const handleKey = (e) => {
    if (e.key === "Enter") search();
  };

  // recent wins/losses
  const wins = battles?.filter((b) => b.battle?.result === "victory").length || 0;
  const losses = battles?.filter((b) => b.battle?.result === "defeat").length || 0;
  const winRate = battles?.length ? Math.round((wins / battles.length) * 100) : null;

  const sortedBrawlers = player
    ? [...(player.brawlers || [])].sort((a, b) => b.trophies - a.trophies)
    : [];

  return (
    <>
      <Head>
        <title>ByteStorm · Brawl Stars Stats</title>
        <meta name="description" content="Track your Brawl Stars stats, brawlers, and battle history" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">
        {/* ── HEADER ── */}
        <header className="header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-bolt">⚡</span>
              <span className="logo-text">ByteStorm</span>
              <span className="logo-sub">Brawl Stats</span>
            </div>
            <div className="search-bar">
              <input
                className="search-input"
                placeholder="Enter player tag  e.g. #ABC123"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={handleKey}
              />
              <button className="search-btn" onClick={() => search()} disabled={loading}>
                {loading ? <span className="spinner" /> : "🔍 Search"}
              </button>
            </div>
          </div>
        </header>

        <main className="main">
          {/* ── HERO (no search yet) ── */}
          {!player && !loading && !error && (
            <div className="hero">
              <div className="hero-graphic">
                <div className="hero-orb orb1" />
                <div className="hero-orb orb2" />
                <div className="hero-orb orb3" />
                <span className="hero-emoji">🎮</span>
              </div>
              <h1 className="hero-title">Track Your Brawl</h1>
              <p className="hero-desc">
                Enter your player tag to instantly see your trophies, brawlers, battle history and more — powered by the official Brawl Stars API.
              </p>
              <div className="demo-tags">
                <span className="demo-label">Try a tag:</span>
                {["#2PP", "#80V9RJV2", "#YLYJGQCG"].map((t) => (
                  <button
                    key={t}
                    className="demo-tag"
                    onClick={() => { setTag(t); search(t); }}
                  >{t}</button>
                ))}
              </div>
            </div>
          )}

          {/* ── LOADING ── */}
          {loading && (
            <div className="loading-screen">
              <div className="loading-ring" />
              <p>Fetching stats…</p>
            </div>
          )}

          {/* ── ERROR ── */}
          {error && (
            <div className="error-box">
              <span className="error-icon">⚠️</span>
              <div>
                <div className="error-title">Could not load player</div>
                <div className="error-msg">{error}</div>
                <div className="error-tip">Make sure the tag is correct (e.g. #ABC123) and try again.</div>
              </div>
            </div>
          )}

          {/* ── PLAYER DATA ── */}
          {player && (
            <div className="player-section">
              {/* Profile banner */}
              <div className="profile-banner">
                <div className="profile-left">
                  <div className="avatar">{player.name?.[0]?.toUpperCase() || "?"}</div>
                  <div className="profile-info">
                    <h2 className="player-name">{player.name}</h2>
                    <div className="player-tag">{player.tag}</div>
                    {player.club?.name && (
                      <div className="player-club">🛡️ {player.club.name}</div>
                    )}
                  </div>
                </div>
                <div className="profile-right">
                  <div className="trophy-big">
                    <span>🏆</span>
                    <span className="trophy-num">{player.trophies?.toLocaleString()}</span>
                  </div>
                  <div className="exp-level">Level {player.expLevel}</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tabs">
                {["overview", "brawlers", "battles"].map((t) => (
                  <button
                    key={t}
                    className={`tab-btn ${activeTab === t ? "active" : ""}`}
                    onClick={() => setActiveTab(t)}
                  >
                    {t === "overview" ? "📊 Overview" : t === "brawlers" ? "🥊 Brawlers" : "⚔️ Battles"}
                  </button>
                ))}
              </div>

              {/* OVERVIEW */}
              {activeTab === "overview" && (
                <div className="tab-content">
                  <div className="stats-grid">
                    <StatCard label="Trophies" value={player.trophies?.toLocaleString()} icon="🏆" accent="#ffd700" />
                    <StatCard label="Highest Trophies" value={player.highestTrophies?.toLocaleString()} icon="👑" accent="#ff9500" />
                    <StatCard label="Brawlers" value={player.brawlers?.length} icon="🥊" accent="#ff6ec7" />
                    <StatCard label="3v3 Victories" value={player["3vs3Victories"]?.toLocaleString()} icon="⚔️" accent="#00e676" />
                    <StatCard label="Solo Victories" value={player.soloVictories?.toLocaleString()} icon="🎯" accent="#00bcd4" />
                    <StatCard label="Duo Victories" value={player.duoVictories?.toLocaleString()} icon="👥" accent="#7c4dff" />
                    <StatCard label="Experience" value={`Lvl ${player.expLevel}`} icon="⭐" accent="#ffeb3b" />
                    <StatCard label="Win Rate (last 25)" value={winRate !== null ? `${winRate}%` : "—"} icon="📈" accent={winRate > 50 ? "#00e676" : "#ff4d4d"} />
                  </div>

                  {/* Recent form mini bar */}
                  {battles && battles.length > 0 && (
                    <div className="recent-form">
                      <div className="section-title">Recent Form</div>
                      <div className="form-bar">
                        {battles.slice(0, 15).map((b, i) => {
                          const r = b.battle?.result;
                          const color = r === "victory" ? "#00e676" : r === "defeat" ? "#ff4d4d" : "#ffb300";
                          return (
                            <div
                              key={i}
                              className="form-dot"
                              style={{ background: color }}
                              title={r || "draw"}
                            />
                          );
                        })}
                      </div>
                      <div className="form-legend">
                        <span style={{ color: "#00e676" }}>■ Win</span>
                        <span style={{ color: "#ff4d4d" }}>■ Loss</span>
                        <span style={{ color: "#ffb300" }}>■ Draw</span>
                      </div>
                    </div>
                  )}

                  {/* Club */}
                  {player.club && (
                    <div className="section-title" style={{ marginTop: "2rem" }}>Club</div>
                  )}
                  {player.club && (
                    <ClubCard club={player.club} />
                  )}
                </div>
              )}

              {/* BRAWLERS */}
              {activeTab === "brawlers" && (
                <div className="tab-content">
                  <div className="brawlers-header">
                    <span className="section-title">All Brawlers ({sortedBrawlers.length})</span>
                  </div>
                  <div className="brawlers-grid">
                    {sortedBrawlers.map((b, i) => (
                      <BrawlerCard key={b.id} b={b} rank={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* BATTLES */}
              {activeTab === "battles" && (
                <div className="tab-content">
                  <div className="section-title">Battle Log</div>
                  {battles && battles.length > 0 ? (
                    <div className="battles-list">
                      {battles.map((b, i) => (
                        <BattleItem key={i} battle={b} />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">No recent battles found.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="footer">
          <span>ByteStorm Brawl Stats</span>
          <span className="footer-sep">·</span>
          <span>Powered by the official <a href="https://developer.brawlstars.com" target="_blank" rel="noreferrer">Brawl Stars API</a></span>
          <span className="footer-sep">·</span>
          <span>Not affiliated with Supercell</span>
        </footer>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0d0e1a;
          --bg2: #12132a;
          --bg3: #1a1b35;
          --border: rgba(255,255,255,0.08);
          --yellow: #ffd700;
          --orange: #ff9500;
          --pink: #ff6ec7;
          --blue: #00bcd4;
          --green: #00e676;
          --purple: #7c4dff;
          --text: #f0f0f8;
          --text2: #9090b0;
          --radius: 16px;
          --radius-sm: 10px;
        }

        html, body {
          background: var(--bg);
          color: var(--text);
          font-family: 'Nunito', sans-serif;
          min-height: 100vh;
        }

        /* SCROLLBAR */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg2); }
        ::-webkit-scrollbar-thumb { background: var(--purple); border-radius: 4px; }

        /* APP */
        .app { min-height: 100vh; display: flex; flex-direction: column; }

        /* HEADER */
        .header {
          position: sticky; top: 0; z-index: 100;
          background: rgba(13,14,26,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
          padding: 0.75rem 1.5rem;
        }
        .header-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
        }
        .logo { display: flex; align-items: center; gap: 0.4rem; }
        .logo-bolt { font-size: 1.6rem; filter: drop-shadow(0 0 8px #ffd700); }
        .logo-text {
          font-family: 'Lilita One', cursive; font-size: 1.4rem;
          background: linear-gradient(135deg, #ffd700, #ff9500);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 0.65rem; color: var(--text2); letter-spacing: 0.1em; text-transform: uppercase; margin-left: 4px; }

        .search-bar { display: flex; gap: 0.5rem; flex: 1; min-width: 200px; }
        .search-input {
          flex: 1; padding: 0.6rem 1rem;
          background: var(--bg3); border: 1px solid var(--border);
          border-radius: 50px; color: var(--text); font-family: inherit; font-size: 0.95rem;
          outline: none; transition: border-color 0.2s;
        }
        .search-input:focus { border-color: var(--yellow); }
        .search-input::placeholder { color: var(--text2); }
        .search-btn {
          padding: 0.6rem 1.4rem; border-radius: 50px; border: none; cursor: pointer;
          background: linear-gradient(135deg, var(--yellow), var(--orange));
          color: #0d0e1a; font-family: 'Nunito', sans-serif; font-weight: 800;
          font-size: 0.9rem; transition: transform 0.15s, box-shadow 0.15s;
          display: flex; align-items: center; gap: 0.4rem;
        }
        .search-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,210,0,0.35); }
        .search-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* SPINNER */
        .spinner {
          width: 16px; height: 16px; border: 2px solid rgba(0,0,0,0.3);
          border-top-color: #000; border-radius: 50%; animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* MAIN */
        .main { flex: 1; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; width: 100%; }

        /* HERO */
        .hero { text-align: center; padding: 4rem 1rem; }
        .hero-graphic { position: relative; width: 120px; height: 120px; margin: 0 auto 2rem; }
        .hero-orb {
          position: absolute; border-radius: 50%;
          animation: float 4s ease-in-out infinite;
        }
        .orb1 { width: 80px; height: 80px; background: radial-gradient(#ffd700, transparent); top: 20px; left: 20px; opacity: 0.4; }
        .orb2 { width: 60px; height: 60px; background: radial-gradient(#ff6ec7, transparent); top: 0; right: 10px; opacity: 0.3; animation-delay: 1.5s; }
        .orb3 { width: 40px; height: 40px; background: radial-gradient(#7c4dff, transparent); bottom: 0; left: 0; opacity: 0.4; animation-delay: 3s; }
        .hero-emoji { position: relative; font-size: 4rem; z-index: 1; display: block; line-height: 120px; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .hero-title {
          font-family: 'Lilita One', cursive; font-size: clamp(2rem, 6vw, 3.5rem);
          background: linear-gradient(135deg, #ffd700 30%, #ff6ec7 80%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
        }
        .hero-desc { color: var(--text2); font-size: 1.05rem; max-width: 500px; margin: 0 auto 2rem; line-height: 1.6; }
        .demo-tags { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; justify-content: center; }
        .demo-label { color: var(--text2); font-size: 0.85rem; }
        .demo-tag {
          padding: 0.35rem 0.9rem; border-radius: 50px; border: 1px solid var(--border);
          background: var(--bg3); color: var(--yellow); font-family: 'Nunito', sans-serif;
          font-weight: 700; cursor: pointer; transition: all 0.2s;
        }
        .demo-tag:hover { border-color: var(--yellow); background: rgba(255,215,0,0.1); }

        /* LOADING */
        .loading-screen { display: flex; flex-direction: column; align-items: center; padding: 6rem; gap: 1.5rem; }
        .loading-ring {
          width: 56px; height: 56px; border: 4px solid var(--border);
          border-top-color: var(--yellow); border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }

        /* ERROR */
        .error-box {
          display: flex; align-items: flex-start; gap: 1rem;
          background: rgba(255,77,77,0.08); border: 1px solid rgba(255,77,77,0.3);
          border-radius: var(--radius); padding: 1.5rem;
        }
        .error-icon { font-size: 1.8rem; flex-shrink: 0; }
        .error-title { font-weight: 800; font-size: 1.1rem; color: #ff4d4d; margin-bottom: 0.3rem; }
        .error-msg { color: var(--text2); margin-bottom: 0.3rem; }
        .error-tip { color: var(--text2); font-size: 0.85rem; }

        /* PROFILE BANNER */
        .player-section { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

        .profile-banner {
          display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;
          background: linear-gradient(135deg, var(--bg3), var(--bg2));
          border: 1px solid var(--border); border-radius: var(--radius);
          padding: 1.5rem 2rem; margin-bottom: 1.5rem;
          position: relative; overflow: hidden;
        }
        .profile-banner::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at top right, rgba(255,215,0,0.06), transparent 60%);
          pointer-events: none;
        }
        .profile-left { display: flex; align-items: center; gap: 1.2rem; }
        .avatar {
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(135deg, var(--yellow), var(--orange));
          display: flex; align-items: center; justify-content: center;
          font-family: 'Lilita One', cursive; font-size: 1.8rem; color: #0d0e1a;
          flex-shrink: 0;
        }
        .player-name { font-family: 'Lilita One', cursive; font-size: 1.5rem; }
        .player-tag { color: var(--text2); font-size: 0.9rem; margin-top: 2px; }
        .player-club { color: var(--blue); font-size: 0.9rem; margin-top: 4px; }
        .profile-right { text-align: right; }
        .trophy-big { display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem; }
        .trophy-num { font-family: 'Lilita One', cursive; font-size: 2rem; color: var(--yellow); }
        .exp-level { color: var(--text2); font-size: 0.9rem; margin-top: 4px; }

        /* TABS */
        .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .tab-btn {
          padding: 0.55rem 1.3rem; border-radius: 50px; border: 1px solid var(--border);
          background: var(--bg3); color: var(--text2); font-family: 'Nunito', sans-serif;
          font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;
        }
        .tab-btn:hover { border-color: var(--yellow); color: var(--text); }
        .tab-btn.active {
          background: linear-gradient(135deg, var(--yellow), var(--orange));
          border-color: transparent; color: #0d0e1a;
        }

        /* STATS GRID */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem; margin-bottom: 1.5rem;
        }
        .stat-card {
          background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm);
          padding: 1rem 1.2rem; display: flex; align-items: center; gap: 0.8rem;
          transition: border-color 0.2s, transform 0.2s;
          border-left: 3px solid var(--accent);
        }
        .stat-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        .stat-icon { font-size: 1.6rem; }
        .stat-value { font-family: 'Lilita One', cursive; font-size: 1.3rem; color: var(--accent); }
        .stat-label { font-size: 0.78rem; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; }

        /* RECENT FORM */
        .recent-form {
          background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 1.2rem 1.5rem;
        }
        .section-title { font-family: 'Lilita One', cursive; font-size: 1.1rem; color: var(--yellow); margin-bottom: 0.8rem; }
        .form-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 0.6rem; }
        .form-dot {
          width: 28px; height: 28px; border-radius: 6px;
          transition: transform 0.15s;
        }
        .form-dot:hover { transform: scale(1.2); }
        .form-legend { display: flex; gap: 1rem; font-size: 0.8rem; }

        /* CLUB CARD */
        .club-card {
          background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 1.2rem 1.5rem;
        }
        .club-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem; }
        .club-icon { font-size: 1.8rem; }
        .club-name { font-weight: 800; font-size: 1.1rem; }
        .club-tag { color: var(--text2); font-size: 0.85rem; }
        .club-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; }
        .club-stat { display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; }

        /* BRAWLERS */
        .brawlers-header { margin-bottom: 1rem; }
        .brawlers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 0.8rem;
        }
        .brawler-card {
          background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm);
          padding: 0.9rem; position: relative; overflow: hidden;
          transition: transform 0.2s, border-color 0.2s;
          border-top: 2px solid var(--tier-color);
        }
        .brawler-card:hover { transform: translateY(-3px); border-color: var(--tier-color); }
        .brawler-rank { font-size: 0.7rem; color: var(--text2); margin-bottom: 4px; }
        .brawler-name { font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; text-transform: capitalize; }
        .brawler-trophies { display: flex; align-items: center; gap: 4px; font-size: 0.9rem; margin-bottom: 4px; }
        .trophy-icon { font-size: 0.85rem; }
        .brawler-power { font-size: 0.8rem; color: var(--text2); margin-bottom: 6px; }
        .power-badge {
          display: inline-block; background: var(--purple); color: white;
          border-radius: 4px; padding: 1px 6px; font-size: 0.75rem; font-weight: 700;
        }
        .brawler-tier-badge {
          display: inline-block; border-radius: 50px; padding: 2px 8px;
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* BATTLES */
        .battles-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .battle-item {
          display: flex; align-items: center; gap: 1rem;
          background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm);
          padding: 0.9rem 1.2rem; border-left: 3px solid var(--result-color);
          transition: transform 0.15s;
        }
        .battle-item:hover { transform: translateX(4px); }
        .battle-mode-icon { font-size: 1.8rem; flex-shrink: 0; }
        .battle-info { flex: 1; }
        .battle-mode-name { font-weight: 800; font-size: 0.95rem; text-transform: capitalize; }
        .battle-map { color: var(--text2); font-size: 0.82rem; }
        .battle-time { color: var(--text2); font-size: 0.75rem; margin-top: 2px; }
        .battle-result { text-align: right; flex-shrink: 0; }
        .battle-result-text { font-weight: 800; font-size: 0.9rem; }
        .trophy-change { font-size: 0.85rem; font-weight: 700; margin-top: 2px; }

        .empty-state { text-align: center; color: var(--text2); padding: 3rem; }

        /* FOOTER */
        .footer {
          border-top: 1px solid var(--border); padding: 1.2rem 1.5rem;
          text-align: center; font-size: 0.82rem; color: var(--text2);
          display: flex; justify-content: center; align-items: center; gap: 0.6rem; flex-wrap: wrap;
        }
        .footer a { color: var(--yellow); text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .footer-sep { opacity: 0.4; }

        /* RESPONSIVE */
        @media (max-width: 600px) {
          .header-inner { flex-direction: column; align-items: stretch; }
          .search-bar { width: 100%; }
          .profile-banner { flex-direction: column; }
          .profile-right { text-align: left; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </>
  );
}

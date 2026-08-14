// Stormfall: Last Horizon design contract — a cinematic arcade-sci-fi frame using deep ultramarine,
// storm teal, warm sandstone, edge-anchored tactical HUD, and a distinct lightning-ring emblem.
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle, type MatchOutcome } from "@/game/scene";
import { applyUpgrade, dungeonReward, getPlayerStats, getStrength, loadProgression, saveProgression, type ProgressionData, upgradeCost } from "@/game/Progression";

const LOGO_URL = "/manus-storage/stormfall-logo-fixed_bf9eea9a.png";
const REFERENCE_URL = "/manus-storage/stormfall-reference_00af8a30.png";
const BEACON_URL = "/manus-storage/stormfall-supply-beacon-fixed_fefc7346.png";

const AVATARS = [
  { id: "kairo", name: "KAIRO", role: "RIFT RANGER", image: "/manus-storage/stormfall-player-anchor_21f4d359.png" },
  { id: "haze", name: "HAZE", role: "STORM SCOUT", image: "/manus-storage/stormfall-haze-final_4236e3e5.png" },
  { id: "vanta", name: "VANTA", role: "FIELD ENGINEER", image: "/manus-storage/stormfall-vanta-final_dc45be78.png" },
] as const;

const RIVALS = [
  { name: "RUSTJAW", image: "/manus-storage/stormfall-rustjaw-final_97dfa9cd.png" },
  { name: "VEIL", image: "/manus-storage/stormfall-veil-final_829eb401.png" },
  { name: "ANKER", image: "/manus-storage/stormfall-anker-final_a22065d6.png" },
] as const;

type AvatarId = (typeof AVATARS)[number]["id"];

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const isDemo =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
  const quickStart =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("play");
  const [started, setStarted] = useState(isDemo || quickStart);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [progression, setProgression] = useState<ProgressionData>(() => loadProgression());
  const [hubView, setHubView] = useState<"home" | "dungeons" | "upgrade" | "loadout" | "settings">("home");
  const [hubNotice, setHubNotice] = useState("");
  const strength = getStrength(progression);
  const playerStats = getPlayerStats(progression);
  const [avatar, setAvatar] = useState<AvatarId>(() => {
    if (typeof window === "undefined") return "kairo";
    const stored = window.sessionStorage.getItem("stormfall-selected-avatar") as AvatarId | null;
    return AVATARS.some((option) => option.id === stored) ? (stored as AvatarId) : "kairo";
  });
  const selectedAvatarRef = useRef<AvatarId>(avatar);
  const gameState = outcome ? "gameover" : started ? "playing" : "menu";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });
    let disposed = false;

    void createGameScene(engine, canvas, {
      demo: isDemo,
              step: "step5",

      avatarId: selectedAvatarRef.current,
      progression,
      onResult: (nextOutcome) => {
        if (nextOutcome === "victory") {
          const reward = dungeonReward(progression);
          setProgression(reward.data);
          window.setTimeout(() => {
            const coins = document.getElementById("result-coins");
            if (coins) coins.textContent = `${reward.reward}まいゲット！`;
          }, 0);
        }
        setOutcome(nextOutcome);
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      },
    }).then((handle) => {
      if (disposed) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      handle.setAvatar(selectedAvatarRef.current);
              if (isDemo || quickStart) handle.start();

      engine.runRenderLoop(() => handle.scene.render());
    });

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      handleRef.current?.dispose();
      handleRef.current = null;
      engine.dispose();
      startedRef.current = false;
    };
  }, [isDemo, quickStart, progression]);

  const changeUpgrade = (key: "hpLevel" | "attackLevel" | "reloadLevel") => {
    const result = applyUpgrade(progression, key);
    setProgression(result.data);
    setHubNotice(result.message);
    window.setTimeout(() => setHubNotice(""), 1500);
  };

  const updateVolume = (key: "sfxVolume" | "bgmVolume", value: number) => {
    const next = { ...progression, [key]: value };
    setProgression(next);
    saveProgression(next);
  };

  const beginMatch = () => {
    handleRef.current?.start();
    void canvasRef.current?.requestPointerLock?.();
    setStarted(true);
  };

  const selectAvatar = (nextAvatar: AvatarId) => {
    window.sessionStorage.setItem("stormfall-selected-avatar", nextAvatar);
    selectedAvatarRef.current = nextAvatar;
    setAvatar(nextAvatar);
    handleRef.current?.setAvatar(nextAvatar);
  };

  return (
    <main className="stormfall-shell combat-mode step5-mode">
      <canvas
        aria-label="Stormfall: Last Horizon の3Dゲーム画面"
        ref={canvasRef}
        className="stormfall-canvas"
        style={{ touchAction: "none" }}
      />
      <div className={`touch-controls ${gameState === "playing" ? "is-playing" : "is-hidden"}`} aria-label="モバイル操作" aria-hidden={gameState !== "playing"}>
        <div className="touch-stick" aria-hidden="true"><div id="touch-knob" className="touch-knob" /></div>
        <span className="touch-swipe-hint">SWIPE TO LOOK</span>
        <div className="touch-actions">
          <button className="touch-pickup" type="button" data-touch-action="pickup">ひろう</button>
          <button className="touch-medkit" type="button" data-touch-action="medkit">回復</button>
          <button className="touch-aim" type="button" data-touch-action="aim">ねらう</button>
          <button className="touch-fire" type="button" data-touch-action="fire">うつ</button>
          <button className="touch-jump" type="button" data-touch-action="jump">ジャンプ</button>
          <button className="touch-crouch" type="button" data-touch-action="crouch">しゃがむ</button>
        </div>
      </div>

      <div id="hud" className="stormfall-hud combat-hud" aria-live="polite">
        <header className="hud-topbar">
          <div className="brand-lockup">
            <img src={LOGO_URL} alt="Stormfall emblem" />
            <div>
              <p>STORMFALL</p>
              <span>LAST HORIZON</span>
            </div>
          </div>
          <div className="storm-readout">
              <span className="eyebrow">たんけんモード</span>
              <strong id="storm-timer">はじまりの遺跡</strong>
              <small className="rig-status">3Dプレイヤー</small>

          </div>
          <div className="remaining-readout">
            <span className="eyebrow">ダンジョン</span>
            <strong>はじまりの遺跡</strong>
          </div>
        </header>

        <aside className="tactical-stack" aria-label="戦術情報">
          <div className="mini-map-frame">
            <div className="mini-map-grid" />
            <div id="mini-safe" className="mini-safe" />
            <i id="mini-player" className="mini-player" />
            <span className="north-mark">N</span>
            <span className="map-label">RIFT-07</span>
          </div>
          <div className="threat-card"><span>エリア</span><b id="zone-status">安全</b></div>
        </aside>

        <section className="dungeon-objective" aria-live="polite"><span>いまの目標</span><strong id="dungeon-objective">敵を3体たおそう！</strong></section>
        <section id="boss-panel" className="boss-panel" aria-label="ボスのHP"><div><span id="boss-name">ボス</span><b id="boss-hp-value">0 / 0</b></div><div className="boss-meter"><i id="boss-hp-fill" /></div></section>
        <section className="vitals-panel" aria-label="プレイヤー状態">
          <div className="vital-row"><span>HP</span><div className="meter"><i id="health-fill" /></div><b id="health-value">100</b></div>
          <div className="vital-row shield"><span>SH</span><div className="meter"><i id="shield-fill" /></div><b id="shield-value">50</b></div>
          <div className="kill-readout"><span>撃破</span><strong id="elims-value">0</strong></div>
        </section>

        <section className="combat-panel" aria-label="武器状態">
          <div className="weapon-tag"><span className="weapon-dot" /><span id="weapon-name">武器なし</span> <i id="aim-status">通常</i></div>
          <div className="ammo-value"><strong id="ammo-value">0</strong><span>/ <i id="reserve-value">0</i></span></div>
          <button className="hud-reload" type="button" data-touch-action="reload">リロード</button>
          <div className="weapon-slots" aria-label="武器スロット">
            <button id="slot-1" className="selected" type="button" data-touch-action="slot1">なし</button>
            <button id="slot-2" type="button" data-touch-action="slot2">なし</button>
            <button id="slot-3" type="button" data-touch-action="slot3">なし</button>
          </div>
          <button id="medkit-value" className="medkit-value" type="button" data-touch-action="medkit">回復 ×0</button>
        </section>

        <section className="signal-card" aria-label="近くの補給物資">
          <img src={BEACON_URL} alt="補給ビーコン" />
          <div><span>FIELD SIGNAL</span><strong id="pickup-status">補給物資を探索</strong></div>
        </section>

        <div className="crosshair" aria-hidden="true"><i /><b /></div>
        <div className="state-chip"><span>うごき</span><strong id="motion-state">待機</strong><i id="crouch-state">立つ</i></div>
        <div id="hit-marker" className="hit-marker" aria-hidden="true">×</div>
        <ol id="event-feed" className="event-feed" aria-label="戦闘ログ" />
        <p className="control-strip">WASD 移動 <b>·</b> マウス ねらう／うつ <b>·</b> R リロード <b>·</b> SPACE ジャンプ <b>·</b> C しゃがむ</p>
      </div>

      {!started && (
        <section className="launch-screen hub-screen" style={{ backgroundImage: `linear-gradient(90deg, rgba(3,10,22,.97) 3%, rgba(3,10,22,.78) 43%, rgba(3,10,22,.3) 100%), url(${REFERENCE_URL})` }}>
          <div className="hub-card">
            <img className="launch-logo" src={LOGO_URL} alt="" />
            <p className="kicker">STORMFALL // ぼうけんの拠点</p>
            <h1>{hubView === "home" ? "おかえり！" : hubView === "dungeons" ? "ダンジョンをえらぼう" : hubView === "upgrade" ? "もっと強くなろう" : hubView === "loadout" ? "そうびを見よう" : "せってい"}</h1>
            <div className="hub-stats"><div className="coin-readout">コイン　<strong>🪙 {progression.coins}</strong></div><div className="strength-readout">つよさ　<strong>{strength}</strong></div></div>
            {hubNotice && <p className="hub-notice">{hubNotice}</p>}
            {hubView === "home" && <>
              <p className="launch-copy">たたかって、コインを集めて、もっと強くなろう！</p>
              <div className="hub-menu"><button type="button" onClick={() => setHubView("dungeons")}>ダンジョンへ</button><button type="button" onClick={() => setHubView("upgrade")}>強くする</button><button type="button" onClick={() => setHubView("loadout")}>そうび</button><button type="button" onClick={() => setHubView("settings")}>設定</button></div>
            </>}
            {hubView === "dungeons" && <div className="hub-panel"><div className="power-compare">{strength >= 125 ? "楽にいけそう！" : strength >= 100 ? "ちょうどいい！" : "ちょっとむずかしいかも！"}</div><button className="dungeon-card" type="button" onClick={beginMatch}><strong>はじまりの遺跡</strong><span>おすすめのつよさ　100</span><span>クリア報酬　🪙 50　／　初回　🪙 100</span><b>出発する</b></button><div className="locked-dungeons"><span className={progression.forestUnlocked ? "unlocked-dungeon" : ""}>{progression.forestUnlocked ? "まよいの森" : "🔒 まよいの森"}<small>{progression.forestUnlocked ? "次のぼうけん" : "はじまりの遺跡をクリアしよう！"}</small></span><span>？？？</span></div><button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
            {hubView === "upgrade" && <div className="hub-panel upgrade-list"><div className="strength-readout">今のつよさ　<strong>{strength}</strong></div>{([ ["hpLevel", "HPアップ", "もっと元気になる！"], ["attackLevel", "こうげき力アップ", "てきに大きなダメージ！"], ["reloadLevel", "リロードアップ", "もっと早くリロード！"] ] as const).map(([key, title, copy]) => { const next = Math.min(5, progression[key] + 1); const current = key === "hpLevel" ? `${playerStats.maxHp}` : key === "attackLevel" ? `${playerStats.damage.toFixed(1)}` : `${playerStats.reloadTime.toFixed(1)}秒`; const nextValue = key === "hpLevel" ? `${playerStats.maxHp + 20}` : key === "attackLevel" ? `${(playerStats.damage * 1.1).toFixed(1)}` : `${(playerStats.reloadTime * 0.9).toFixed(1)}秒`; return <div className="upgrade-card" key={key}><div><strong>{title}</strong><span>{copy}</span><small>Lv.{progression[key]} → Lv.{next}</small><small>{key === "hpLevel" ? "HP" : key === "attackLevel" ? "こうげき力" : "リロード時間"}　{current} → {nextValue}</small></div><button type="button" disabled={progression[key] >= 5 || progression.coins < upgradeCost(progression[key])} onClick={() => changeUpgrade(key)}>{progression[key] >= 5 ? "最大" : `${upgradeCost(progression[key])}コイン`}</button></div>})}<button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
            {hubView === "loadout" && <div className="hub-panel"><p>今つかえる武器</p><div className="loadout-list"><span>アサルトライフル</span><span>サブマシンガン</span><span>ショットガン</span></div><button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
            {hubView === "settings" && <div className="hub-panel settings-panel"><label>効果音　<input type="range" min="0" max="1" step="0.1" value={progression.sfxVolume} onChange={(event) => updateVolume("sfxVolume", Number(event.target.value))} /></label><label>BGM　<input type="range" min="0" max="1" step="0.1" value={progression.bgmVolume} onChange={(event) => updateVolume("bgmVolume", Number(event.target.value))} /></label><button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
          </div>
          {hubView === "home" && <aside className="avatar-chooser" aria-label="キャラクター選択"><div className="chooser-heading"><span>PLAYER</span><strong>キャラクターを選択</strong></div><div className="avatar-grid">{AVATARS.map((option) => <button key={option.id} type="button" className={`avatar-card ${avatar === option.id ? "selected" : ""}`} onClick={() => selectAvatar(option.id)} aria-pressed={avatar === option.id}><img src={option.image} alt={`${option.name} の3Dアバター`} /><span>{option.name}</span><small>{option.role}</small></button>)}</div></aside>}
        </section>
      )}

      {outcome && (
        <section className="result-screen">
          <img src={LOGO_URL} alt="" />
                      <p>{outcome === "victory" ? "ダンジョンクリア！" : "ゲームオーバー"}</p>
            <h2>{outcome === "victory" ? "はじまりの遺跡をクリアしたよ" : "もう一度ちょうせんしよう"}</h2>
            <div className="result-stats"><span>たおした敵：<b id="result-elims">0</b>体</span><span>クリア時間：<b id="result-time">--:--</b></span><span>コイン：<b id="result-coins">報酬を計算中</b></span></div>
            <div className="result-actions"><button type="button" onClick={() => { window.history.replaceState({}, "", `${window.location.pathname}?play=1`); window.location.reload(); }}>もう一度</button><button type="button" onClick={() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }}>拠点へもどる</button></div>

        </section>
      )}
    </main>
  );
}

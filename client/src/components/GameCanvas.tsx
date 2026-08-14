// Stormfall: Last Horizon design contract — a cinematic arcade-sci-fi frame using deep ultramarine,
// storm teal, warm sandstone, edge-anchored tactical HUD, and a distinct lightning-ring emblem.
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle, type MatchOutcome } from "@/game/scene";
import { applyUpgrade, dungeonReward, getPlayerStats, getStrength, loadProgression, markTutorialSeen, resetProgression, saveProgression, type ProgressionData, type TutorialKey, upgradeCost } from "@/game/Progression";
import type { DungeonId } from "@/game/DungeonConfig";

const LOGO_URL = "/manus-storage/stormfall-logo-fixed_bf9eea9a.png";
const REFERENCE_URL = "/manus-storage/stormfall-reference_00af8a30.png";
const BEACON_URL = "/manus-storage/stormfall-supply-beacon-fixed_fefc7346.png";
const FOREST_REFERENCE_URL = "/manus-storage/mayoi-forest-reference_d98ef10a.png";
const FOREST_GUARDIAN_URL = "/manus-storage/mayoi-guardian-reference_0099b23a.png";
const CAVE_REFERENCE_URL = "/manus-storage/kurayami-cave-reference_652c556d.png";
const GORUM_REFERENCE_URL = "/manus-storage/gorum-reference_88e81959.png";

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
type TutorialHint = { text: string; target: "move" | "look" | "aim" | "fire" | "pickup" | "jump" };

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const isDemo =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
  const quickStart =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("play");
  const dungeonQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("dungeon") : null;
  const selectedDungeon = (dungeonQuery === "forest" || dungeonQuery === "cave" ? dungeonQuery : "ruins") as DungeonId;
  const dungeonName = selectedDungeon === "cave" ? "くらやみの洞窟" : selectedDungeon === "forest" ? "まよいの森" : "はじまりの遺跡";
  const [started, setStarted] = useState(isDemo || quickStart);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [progression, setProgression] = useState<ProgressionData>(() => loadProgression());
  const progressionRef = useRef(progression);
  const [hubView, setHubView] = useState<"home" | "dungeons" | "upgrade" | "loadout" | "settings">("home");
  const [hubNotice, setHubNotice] = useState("");
  const [tutorial, setTutorial] = useState<TutorialHint | null>(null);
  const tutorialTimerRef = useRef<number | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const debugMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
  const [resultReward, setResultReward] = useState<{ base: number; bonus: number; total: number; coinsAfter: number } | null>(null);
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
      dungeonId: selectedDungeon,
      avatarId: selectedAvatarRef.current,
      progression,
      debug: debugMode,
      onTutorial: (key, text, target) => {
        const next = markTutorialSeen(progressionRef.current, key);
        progressionRef.current = next;
        setTutorial({ text, target });
        if (tutorialTimerRef.current) window.clearTimeout(tutorialTimerRef.current);
        tutorialTimerRef.current = window.setTimeout(() => setTutorial(null), 3000);
      },
      onResult: (nextOutcome, summary) => {
        if (nextOutcome === "victory" && summary) {
          const reward = dungeonReward(progressionRef.current, summary.dungeonId, summary.bonusReward);
          progressionRef.current = reward.data;
          setProgression(reward.data);
          setResultReward({ base: reward.baseReward, bonus: reward.bonusReward, total: reward.reward, coinsAfter: reward.data.coins });
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
  }, [isDemo, quickStart, selectedDungeon, progression, debugMode]);

  const changeUpgrade = (key: "hpLevel" | "attackLevel" | "reloadLevel") => {
    const result = applyUpgrade(progression, key);
    progressionRef.current = result.data;
    setProgression(result.data);
    setHubNotice(result.message);
    window.setTimeout(() => setHubNotice(""), 1500);
  };

  const updateVolume = (key: "sfxVolume" | "bgmVolume", value: number) => {
    const next = { ...progression, [key]: value };
    progressionRef.current = next;
    setProgression(next);
    saveProgression(next);
  };

  const beginMatch = (dungeonId: DungeonId = "ruins") => {
    if (dungeonId === "forest" && !progression.forestUnlocked) return;
    if (dungeonId === "cave" && !progression.caveUnlocked) return;
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

  const confirmResetProgress = () => {
    const next = resetProgression();
    progressionRef.current = next;
    setProgression(next);
    window.sessionStorage.removeItem("stormfall-selected-avatar");
    selectedAvatarRef.current = "kairo";
    setAvatar("kairo");
    setHubNotice("セーブデータを最初の状態にもどしたよ");
    setResetConfirm(false);
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
        <div className={`touch-stick ${tutorial?.target === "move" ? "tutorial-focus" : ""}`} aria-hidden="true"><div id="touch-knob" className="touch-knob" /></div>
        <span className={`touch-swipe-hint ${tutorial?.target === "look" ? "tutorial-focus" : ""}`}>SWIPE TO LOOK</span>
        <div className="touch-actions">
          <button className={`touch-pickup ${tutorial?.target === "pickup" ? "tutorial-focus" : ""}`} type="button" data-touch-action="pickup">ひろう</button>
          <button className="touch-medkit" type="button" data-touch-action="medkit">回復</button>
          <button className={`touch-aim ${tutorial?.target === "aim" ? "tutorial-focus" : ""}`} type="button" data-touch-action="aim">ねらう</button>
          <button className={`touch-fire ${tutorial?.target === "fire" ? "tutorial-focus" : ""}`} type="button" data-touch-action="fire">うつ</button>
          <button className={`touch-jump ${tutorial?.target === "jump" ? "tutorial-focus" : ""}`} type="button" data-touch-action="jump">ジャンプ</button>
          <button className="touch-crouch" type="button" data-touch-action="crouch">しゃがむ</button>
        </div>
      </div>
      {tutorial && <div className="tutorial-toast" role="status">{tutorial.text}</div>}

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
              <strong id="storm-timer">{dungeonName}</strong>
              <small className="rig-status">3Dプレイヤー</small>

          </div>
          <div className="remaining-readout">
            <span className="eyebrow">ダンジョン</span>
            <strong>{dungeonName}</strong>
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
        <section id="boss-panel" className={`boss-panel ${selectedDungeon === "forest" ? "forest-boss-panel" : selectedDungeon === "cave" ? "cave-boss-panel" : ""}`} style={selectedDungeon === "forest" ? { backgroundImage: `linear-gradient(90deg, rgba(12,38,20,.96), rgba(12,38,20,.68)), url(${FOREST_GUARDIAN_URL})` } : selectedDungeon === "cave" ? { backgroundImage: `linear-gradient(90deg, rgba(18,14,24,.96), rgba(18,14,24,.68)), url(${GORUM_REFERENCE_URL})` } : undefined} aria-label="ボスのHP"><div><span id="boss-name">ボス</span><b id="boss-hp-value">0 / 0</b></div><div className="boss-meter"><i id="boss-hp-fill" /></div></section>
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
          <div className="hub-world-signals" aria-hidden="true"><i className="hub-storm-arc" /><i className="hub-nav-pylon" /><i className="hub-supply-beacon" /><span>STORM FRONT // RIFT-07</span></div>
          <div className="hub-card">
            <img className="launch-logo" src={LOGO_URL} alt="" />
            <p className="kicker">STORMFALL // 前線作戦端末</p>
            <h1>{hubView === "home" ? "次の降下をえらべ" : hubView === "dungeons" ? "降下先をえらべ" : hubView === "upgrade" ? "装備と能力を調整" : hubView === "loadout" ? "使用可能なそうび" : "作戦設定"}</h1>
            <div className="hub-stats"><div className="coin-readout">コイン　<strong>🪙 {progression.coins}</strong></div><div className="strength-readout">つよさ　<strong>{strength}</strong></div></div>
            {hubNotice && <p className="hub-notice">{hubNotice}</p>}
            {hubView === "home" && <>
              <p className="launch-copy">現在地：嵐の外縁 // 次の降下地点を指定せよ。</p>
              {progression.iceMountainDiscovered ? <p className="hub-notice">新しい場所が見つかった！　🔒 こおりの山</p> : progression.caveUnlocked ? <p className="hub-notice">新しい場所が見つかった！　くらやみの洞窟</p> : null}
              <div className="hub-menu"><button type="button" onClick={() => setHubView("dungeons")}>ダンジョンへ</button><button type="button" onClick={() => setHubView("upgrade")}>強くする</button><button type="button" onClick={() => setHubView("loadout")}>そうび</button><button type="button" onClick={() => setHubView("settings")}>設定</button></div>
            </>}
            {hubView === "dungeons" && <div className="hub-panel"><div className="power-compare">{strength >= 200 ? "楽にいけそう！" : strength >= 150 ? "ちょうどいい！" : "ちょっとむずかしいかも！"}</div><button className="dungeon-card" type="button" onClick={() => beginMatch("ruins")}><strong>はじまりの遺跡</strong><span>おすすめのつよさ　100</span><span>クリア報酬　🪙 50　／　初回　🪙 100</span><b>出発する</b></button><div className="locked-dungeons"><button type="button" className={`forest-dungeon ${progression.forestUnlocked ? "unlocked-dungeon" : ""}`} style={progression.forestUnlocked ? { backgroundImage: `linear-gradient(90deg, rgba(3,18,11,.93), rgba(3,18,11,.55)), url(${FOREST_REFERENCE_URL})` } : undefined} disabled={!progression.forestUnlocked} onClick={() => { window.history.replaceState({}, "", `${window.location.pathname}?play=1&dungeon=forest`); window.location.reload(); }}><strong>{progression.forestUnlocked ? "まよいの森" : "🔒 まよいの森"}</strong><small>{progression.forestUnlocked ? "おすすめのつよさ　150　／　クリア報酬　🪙 100" : "はじまりの遺跡をクリアしよう！"}</small><b>{progression.forestUnlocked ? "出発する" : "まだ行けないよ"}</b></button><button type="button" className={`forest-dungeon cave-dungeon ${progression.caveUnlocked ? "unlocked-dungeon" : ""}`} style={progression.caveUnlocked ? { backgroundImage: `linear-gradient(90deg, rgba(12,9,19,.94), rgba(12,9,19,.56)), url(${CAVE_REFERENCE_URL})` } : undefined} disabled={!progression.caveUnlocked} onClick={() => { window.history.replaceState({}, "", `${window.location.pathname}?play=1&dungeon=cave`); window.location.reload(); }}><strong>{progression.caveUnlocked ? "くらやみの洞窟" : "🔒 くらやみの洞窟"}</strong><small>{progression.caveUnlocked ? "おすすめのつよさ　200　／　初回　🪙 200" : "まよいの森をクリアしよう！"}</small><b>{progression.caveUnlocked ? "出発する" : "まだ行けないよ"}</b></button><span>{progression.iceMountainDiscovered ? "🔒 こおりの山" : "？？？"}</span></div><button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
            {hubView === "upgrade" && <div className="hub-panel upgrade-list"><div className="strength-readout">今のつよさ　<strong>{strength}</strong></div>{([ ["hpLevel", "HPアップ", "もっと元気になる！"], ["attackLevel", "こうげき力アップ", "てきに大きなダメージ！"], ["reloadLevel", "リロードアップ", "もっと早くリロード！"] ] as const).map(([key, title, copy]) => { const next = Math.min(5, progression[key] + 1); const current = key === "hpLevel" ? `${playerStats.maxHp}` : key === "attackLevel" ? `${playerStats.damage.toFixed(1)}` : `${playerStats.reloadTime.toFixed(1)}秒`; const nextValue = key === "hpLevel" ? `${playerStats.maxHp + 20}` : key === "attackLevel" ? `${(playerStats.damage * 1.1).toFixed(1)}` : `${(playerStats.reloadTime * 0.9).toFixed(1)}秒`; return <div className="upgrade-card" key={key}><div><strong>{title}</strong><span>{copy}</span><small>Lv.{progression[key]} → Lv.{next}</small><small>{key === "hpLevel" ? "HP" : key === "attackLevel" ? "こうげき力" : "リロード時間"}　{current} → {nextValue}</small></div><button type="button" disabled={progression[key] >= 5 || progression.coins < upgradeCost(progression[key])} onClick={() => changeUpgrade(key)}>{progression[key] >= 5 ? "最大" : `${upgradeCost(progression[key])}コイン`}</button></div>})}<button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
            {hubView === "loadout" && <div className="hub-panel"><p>今つかえる武器</p><div className="loadout-list"><span>アサルトライフル</span><span>サブマシンガン</span><span>ショットガン</span></div><button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
            {hubView === "settings" && <div className="hub-panel settings-panel"><label>効果音　<input type="range" min="0" max="1" step="0.1" value={progression.sfxVolume} onChange={(event) => updateVolume("sfxVolume", Number(event.target.value))} /></label><label>BGM　<input type="range" min="0" max="1" step="0.1" value={progression.bgmVolume} onChange={(event) => updateVolume("bgmVolume", Number(event.target.value))} /></label><button className="save-reset-button" type="button" onClick={() => setResetConfirm(true)}>セーブデータをリセット</button><button className="hub-back" type="button" onClick={() => setHubView("home")}>もどる</button></div>}
          </div>
          {hubView === "home" && <aside className="avatar-chooser" aria-label="キャラクター選択"><div className="chooser-heading"><span>PLAYER</span><strong>キャラクターを選択</strong></div><div className="avatar-grid">{AVATARS.map((option) => <button key={option.id} type="button" className={`avatar-card ${avatar === option.id ? "selected" : ""}`} onClick={() => selectAvatar(option.id)} aria-pressed={avatar === option.id}><img src={option.image} alt={`${option.name} の3Dアバター`} /><span>{option.name}</span><small>{option.role}</small></button>)}</div></aside>}
        </section>
      )}

      {resetConfirm && <section className="reset-confirm" role="dialog" aria-modal="true"><div><p>本当に最初からやり直す？</p><small>コイン・強化・解放・チュートリアルが最初の状態にもどるよ。</small><div><button type="button" onClick={confirmResetProgress}>やり直す</button><button type="button" onClick={() => setResetConfirm(false)}>やめる</button></div></div></section>}
      {debugMode && <aside id="playtest-debug" className="playtest-debug">読み込み中…</aside>}

      {outcome && (
        <section className="result-screen">
          <img src={LOGO_URL} alt="" />
                      <p>{outcome === "victory" ? `${dungeonName}クリア！` : "ゲームオーバー"}</p>
            <h2>{outcome === "victory" ? `${dungeonName}をクリアしたよ` : "もう一度ちょうせんしよう"}</h2>
            {outcome === "victory" && selectedDungeon === "forest" && <p className="hub-notice">新しい場所が見つかった！　くらやみの洞窟</p>}{outcome === "victory" && selectedDungeon === "cave" && <p className="hub-notice">新しい場所が見つかった！　🔒 こおりの山</p>}
            <div className="result-stats"><span>たおした敵：<b id="result-elims">0</b>体</span><span>クリア時間：<b id="result-time">--:--</b></span><span>基本報酬：<b>{resultReward?.base ?? 0}</b></span>{(selectedDungeon === "forest" || selectedDungeon === "cave") && <span>宝箱：<b>{resultReward?.bonus ?? 0}</b></span>}<span>今回ゲット：<b id="result-coins">{resultReward ? `${resultReward.total}まい` : "報酬を計算中"}</b></span><span>もっているコイン：<b>{resultReward?.coinsAfter ?? progression.coins}</b></span></div>
            <div className="result-actions"><button type="button" onClick={() => { window.history.replaceState({}, "", `${window.location.pathname}?play=1&dungeon=${selectedDungeon}`); window.location.reload(); }}>もう一度</button><button type="button" onClick={() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }}>拠点へもどる</button></div>

        </section>
      )}
    </main>
  );
}

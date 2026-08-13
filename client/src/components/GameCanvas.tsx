// Stormfall: Last Horizon design contract — a cinematic arcade-sci-fi frame using deep ultramarine,
// storm teal, warm sandstone, edge-anchored tactical HUD, and a distinct lightning-ring emblem.
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle, type MatchOutcome } from "@/game/scene";

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
  const [started, setStarted] = useState(isDemo);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [avatar, setAvatar] = useState<AvatarId>("kairo");

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
      step: "step1",
      onResult: (nextOutcome) => {
        setOutcome(nextOutcome);
        if (document.pointerLockElement === canvas) document.exitPointerLock();
      },
    }).then((handle) => {
      if (disposed) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      if (isDemo) handle.start();
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
  }, [isDemo]);

  const beginMatch = () => {
    handleRef.current?.start();
    void canvasRef.current?.requestPointerLock?.();
    setStarted(true);
  };

  const selectAvatar = (nextAvatar: AvatarId) => {
    setAvatar(nextAvatar);
    handleRef.current?.setAvatar(nextAvatar);
  };

  return (
    <main className="stormfall-shell step1-mode">
      <canvas
        aria-label="Stormfall: Last Horizon の3Dゲーム画面"
        ref={canvasRef}
        className="stormfall-canvas"
        style={{ touchAction: "none" }}
      />

      <div id="hud" className="stormfall-hud step1-hud" aria-live="polite">
        <header className="hud-topbar">
          <div className="brand-lockup">
            <img src={LOGO_URL} alt="Stormfall emblem" />
            <div>
              <p>STORMFALL</p>
              <span>LAST HORIZON</span>
            </div>
          </div>
          <div className="storm-readout">
            <span className="eyebrow">EXPLORATION MODE</span>
            <strong id="storm-timer">STEP 1 // EXPLORE</strong>
          </div>
          <div className="remaining-readout">
            <span className="eyebrow">SURVIVORS</span>
            <strong>FREE ROAM</strong>
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
          <div className="threat-card"><span>ZONE</span><b id="zone-status">STABLE</b></div>
        </aside>

        <section className="vitals-panel" aria-label="プレイヤー状態">
          <div className="vital-row"><span>HP</span><div className="meter"><i id="health-fill" /></div><b id="health-value">100</b></div>
          <div className="vital-row shield"><span>SH</span><div className="meter"><i id="shield-fill" /></div><b id="shield-value">50</b></div>
          <div className="kill-readout"><span>ELIMS</span><strong id="elims-value">0</strong></div>
        </section>

        <section className="combat-panel" aria-label="武器状態">
          <div className="weapon-tag"><span className="weapon-dot" />ARC PULSE RIFLE <i id="aim-status">HIP</i></div>
          <div className="ammo-value"><strong id="ammo-value">30</strong><span>/ <i id="reserve-value">90</i></span></div>
          <div className="weapon-slots"><i className="selected">1</i><i>2</i><i>3</i><i>4</i></div>
        </section>

        <section className="signal-card" aria-label="近くの補給物資">
          <img src={BEACON_URL} alt="補給ビーコン" />
          <div><span>FIELD SIGNAL</span><strong id="pickup-status">補給物資を探索</strong></div>
        </section>

        <div className="crosshair" aria-hidden="true"><i /><b /></div>
        <div className="state-chip"><span>MOVE STATE</span><strong id="motion-state">IDLE</strong><i id="crouch-state">STAND</i></div>
        <div id="hit-marker" className="hit-marker" aria-hidden="true">×</div>
        <ol id="event-feed" className="event-feed" aria-label="戦闘ログ" />
        <p className="control-strip">WASD 移動 <b>·</b> SHIFT ダッシュ <b>·</b> SPACE ジャンプ <b>·</b> C / CTRL しゃがみ <b>·</b> マウス Orbit</p>
      </div>

      {!started && (
        <section className="launch-screen" style={{ backgroundImage: `linear-gradient(90deg, rgba(3,10,22,.97) 3%, rgba(3,10,22,.77) 43%, rgba(3,10,22,.25) 100%), url(${REFERENCE_URL})` }}>
          <div className="launch-content">
            <img className="launch-logo" src={LOGO_URL} alt="" />
            <p className="kicker">SOLO EXPEDITION // RIFT-07</p>
            <h1>嵐の外縁で、<em>次の一手</em>を奪え。</h1>
            <p className="launch-copy">浮遊群島に降下し、物資を確保せよ。電磁嵐が収束する前に、最後の生存者を決める。</p>
            <button type="button" className="launch-button" onClick={beginMatch}>STEP 1を開始 <span>↗</span></button>
            <p className="launch-note">STEP 1 — 3D探索基盤 / 戦闘システムは次の段階で追加</p>
          </div>
          <aside className="avatar-chooser" aria-label="降下アバター選択">
            <div className="chooser-heading"><span>DEPLOYMENT LOADOUT</span><strong>アバターを選択</strong></div>
            <div className="avatar-grid">
              {AVATARS.map((option) => (
                <button key={option.id} type="button" className={`avatar-card ${avatar === option.id ? "selected" : ""}`} onClick={() => selectAvatar(option.id)} aria-pressed={avatar === option.id}>
                  <img src={option.image} alt={`${option.name} の3Dアバター`} />
                  <span>{option.name}</span><small>{option.role}</small>
                </button>
              ))}
            </div>
            <div className="rival-roster step1-hidden">
              <div><span>THREAT ROSTER</span><b>現地ライバル</b></div>
              <ul>{RIVALS.map((rival) => <li key={rival.name}><img src={rival.image} alt="" /><span>{rival.name}</span></li>)}</ul>
            </div>
          </aside>
        </section>
      )}

      {outcome && (
        <section className="result-screen">
          <img src={LOGO_URL} alt="" />
          <p>{outcome === "victory" ? "RIFT SECURED" : "SIGNAL LOST"}</p>
          <h2>{outcome === "victory" ? "最後の地平線を制圧" : "嵐に飲まれた"}</h2>
          <button type="button" onClick={() => window.location.reload()}>もう一度降下する</button>
        </section>
      )}
    </main>
  );
}

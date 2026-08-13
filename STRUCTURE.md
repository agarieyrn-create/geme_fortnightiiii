# Stormfall: Last Horizon — Architecture

## Overview

React はフルスクリーンのキャンバスと開始オーバーレイだけを管理し、Babylon.js がレンダリング、カメラ、入力、シーン、サウンドを担う。ゲーム規則は `client/src/game/` のフレームワーク非依存な TypeScript クラスに置き、メッシュは各ゲームオブジェクトが所有する。

```text
App.tsx
└── GameCanvas.tsx
    └── createGameScene(engine, canvas)
        └── GameWorld
            ├── InputManager
            ├── Player
            │   ├── Health
            │   └── Weapon
            ├── Rival[]
            │   ├── Health
            │   └── RivalBrain
            ├── ProjectileSystem
            ├── Pickup[]
            ├── StormZone
            ├── WorldBuilder
            └── HudController
```

## Runtime Modules

| Module | Ownership | Responsibility |
|---|---|---|
| `scene.ts` | Babylon lifecycle | シーン生成、レンダーループへの接続、`GameHandle` の破棄処理 |
| `GameWorld.ts` | Game session | 開始・更新・勝敗状態、各システムの更新順、ゲームイベントの仲介 |
| `Player.ts` | Player avatar | 移動、ジャンプ、ダッシュ、照準方向、被弾、持ち物、メッシュ所有 |
| `Rival.ts` | NPC avatar | 索敵、移動、射撃、回避、被弾、脱落、メッシュ所有 |
| `RivalBrain.ts` | NPC behavior | 安全領域優先、プレイヤー索敵、距離に応じた追跡・横移動・射撃の状態遷移 |
| `Weapon.ts` | Combat behavior | 発射間隔、弾薬、ダメージ、弾丸生成要求 |
| `ProjectileSystem.ts` | Dense simulation | 弾丸の移動、寿命、地形・エンティティ当たり判定、ヒットイベント |
| `StormZone.ts` | Match pressure | 段階的な半径縮小、嵐外ダメージ、境界メッシュ、次縮小までの時間 |
| `Pickup.ts` | World interaction | 武器弾薬・シールドの接近判定、回収、視覚的な浮遊・発光 |
| `WorldBuilder.ts` | Environment | 地形、岩、浅瀬、航法パイロン、供給物資、遮蔽物のプロシージャル配置 |
| `HudController.ts` | Presentation | DOM上の状態パネル更新、照準、残存人数、体力、弾薬、嵐タイマー、ミニマップ |
| `InputManager.ts` | Input | 意味的操作（move、look、jump、sprint、fire、interact）とポインタロックの管理 |

## Data and State

`GameWorld` は `playing`、`victory`、`defeat` の明示的な試合状態を持つ。プレイヤーとNPCは `Health` コンポーネントによりHPとシールドを共有し、ダメージは単一の `applyDamage` 経路を通す。HUDにはゲーム状態の読み取り専用スナップショットだけを渡し、DOM更新がゲーム規則を変更しないようにする。

## Frame Order

各フレームでは、入力をサンプリングし、プレイヤー移動、NPCの意思決定、弾丸更新、補給物資の接近回収、嵐の縮小とダメージ、勝敗判定、HUDスナップショット更新の順で実行する。視覚効果はこの結果を読むだけで、ゲーム規則を持たない。

## Asset Hints

砂岩・玄武岩・土・浅瀬の世界はプロシージャル地形と `stormfall-terrain-atlas` の質感を中心に構築する。 `stormfall-logo` はDOMの開始画面とfaviconで使い、 `stormfall-supply-beacon` は琥珀の浮遊ビーコンを設計するための視覚基準にする。敵、プレイヤー、岩、パイロンは読み取りやすさとパフォーマンスを優先してプリミティブを組み合わせた独自ジオメトリで構築する。

## Cleanup Contract

`createGameScene` は `{ scene, dispose }` を返す。`dispose` は `GameWorld` のリスナー、DOM HUD、ポインタロック状態、オーディオノード、Babylonシーンを順番に解放する。`GameCanvas` はReact StrictModeの二重マウントを防ぎ、ResizeListenerとEngineを必ず破棄する。

# Stormfall: Last Horizon — TPS Architecture v2

## Design Contract

ReactはゲームキャンバスとHUDのフレームだけを担当し、Babylon.jsは3D描画とシーンライフサイクルを担当する。ゲーム規則は`client/src/game/`のプレーンTypeScriptクラスに分離し、各クラスは明示的な入力・状態・出力の契約を持つ。`GameWorld`は調停役に限定し、プレイヤーの移動、カメラ、武器、敵AI、フィールド、HUDを直接実装しない。

## Runtime Tree

```text
App.tsx
└── GameCanvas.tsx
    ├── InputManager              // キーボード・マウス・ポインターロック・将来のゲームパッド
    └── createGameScene
        └── GameWorld              // 試合状態とシステムの更新順だけを調停
            ├── WorldBuilder       // 地形・丘・岩・木・建物・道・障害物・補給物資
            ├── PlayerController   // 移動、加速、方向転換、ジャンプ、しゃがみ、地面判定
            │   ├── CharacterRig   // 階層メッシュ、生成レンダー、姿勢
            │   └── AnimationController // Idle/Walk/Run/Jump/Fall/Land/Crouch/Aim/Fire
            ├── CameraController   // TPS Orbit、肩越し照準、Pitch制限、障害物補正
            ├── WeaponSystem       // Arc Pulse Rifle、マガジン、リロード、発射間隔、Ray/Projectile
            ├── EnemyDirector      // EnemyAgentの生成、索敵、追跡、射撃、死亡
            │   └── EnemyAgent      // EnemyStateMachine + CharacterRig + HealthState
            ├── ProjectileSystem   // 弾の移動、寿命、命中、ダメージイベント
            ├── PickupSystem       // 弾薬、シールド、回復、接近回収
            ├── StormSystem        // 安全領域、縮小、外側ダメージ
            └── HudController      // DOMへ読み取り専用HudSnapshotを反映
```

## Phase Contracts

| Phase | Module | 完成条件 |
|---|---|---|
| 1 | `CharacterRig` + `CameraController` | キャラクターが後方カメラで表示され、カメラがOrbitする |
| 2 | `InputManager` + `PlayerController` | WASD斜め移動、移動方向への自然な回転、加速と減速 |
| 3 | `PlayerController` | Shift走行、Spaceジャンプ、重力、着地、C/Ctrlしゃがみと低い当たり判定 |
| 4 | `AnimationController` | Idle/Walk/Run/Jump/Fall/Land/Crouch Idle/Crouch Walk/Aim/Fireの状態遷移 |
| 5 | `WeaponSystem` | 右クリック照準、左クリック射撃、弾数、マガジン、Rリロード、マズルフラッシュ、命中判定 |
| 6 | `HealthState` + `EnemyAgent` | HP100、被弾、発見、接近、攻撃、死亡、残存人数更新 |
| 7 | `WorldBuilder` | 草原、丘、木、岩、建物、道、高低差、障害物を探索可能な3D空間へ配置 |
| 8 | `HudController` | HP、武器、残弾、クロスヘア、照準・移動状態、敵数を表示 |
| 9 | `TuningProfile` | 移動速度、加速度、方向転換、ジャンプ高度、重力、カメラ感度、射撃感覚を一元調整 |

## Data Contracts

`InputSnapshot`は`moveX/moveY/lookX/lookY/jumpPressed/sprint/crouch/aim/fire/reloadPressed`を持ち、ゲームロジックはDOMイベントを直接参照しない。`PlayerState`は位置、速度、垂直速度、接地、しゃがみ、照準、アニメーション状態、HealthStateを持つ。`WeaponState`はmagazine、reserve、cooldown、reloadTimer、isReloadingを持つ。`EnemyState`は`idle/search/chase/attack/hurt/dead`を持つ。`HudSnapshot`は表示専用で、DOMからゲーム状態を変更できない。

## Update Order

毎フレーム、`InputManager.sample()`、`PlayerController.update()`、`CameraController.update()`、`AnimationController.update()`、`WeaponSystem.update()`、`EnemyDirector.update()`、`ProjectileSystem.update()`、`PickupSystem.update()`、`StormSystem.update()`、`HudController.render()`の順で実行する。`GameWorld`はこの順序を調停し、個別システムの内部規則を持たない。

## Cleanup and Fallback

各システムは`dispose()`を実装し、InputManagerのWindow／Canvas／PointerLockイベント、タイマー、Babylonメッシュ、HUD参照を解放する。生成キャラクターレンダーが未読込みでも、CharacterRigの手続きメッシュを表示してゲーム操作を止めない。`?demo`はInputManagerを迂回せず、同じInputSnapshot契約へ自動入力を注入する。

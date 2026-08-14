# Verification Notes — Real GLB Humanoid

The PC `/?demo` capture shows the player as a skinned Soldier GLB, not a plane, sprite, or billboard. The model has a visible head, torso, arms, legs, boots, side profile geometry, and shaded surfaces. The HUD displays `PLAYER RIG // GLB HUMANOID · SKELETON`, while the existing minimap, 3D field, exploration HUD, and camera composition remain present.

The mobile-width `/?demo` capture shows the same 3D world, minimap, touch joystick, right swipe hint, and Jump/Crouch/Run buttons. The player was not visible in that particular frame because the camera was aimed away from the spawn position; this is a camera framing observation, not a failed asset load. TypeScript checks passed, and the browser console showed no GLB or shader error in the latest run.

Asset source used for the model: https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb
Uploaded WebDev asset: /manus-storage/stormfall-robot_94040332.glb
GLB metadata: 74 nodes, 2 skins, 14 animation clips including `Idle`, `Jump`, `Running`, `Walking`, `WalkJump`, 14 meshes. The player now uses the real GLB skinned model and its AnimationGroups; no billboard or portrait plane is created in the player path.

## RobotExpressive verification

The current desktop capture shows the player as the actual RobotExpressive skinned GLB from the front after correcting its model-forward axis. It has volume, depth, separate limbs, torso, head, hands, and feet; the player path no longer creates a portrait plane or billboard. The mobile capture shows the same GLB geometry entering from the left edge along with the minimap, right swipe hint, and Jump/Crouch/Run controls. The HUD diagnostic remains `PLAYER RIG // GLB HUMANOID · SKELETON`.

## Forward Axis correction verification

The live path keeps `PlayerController` movement unchanged: camera forward remains `(sin(yaw), 0, cos(yaw))`, right remains `(forward.z, 0, -forward.x)`, and target yaw remains `atan2(direction.x, direction.z)` with shortest-angle interpolation. The correction is isolated to `HumanoidModelController`: `RobotExpressive.glb` now uses local yaw `0` instead of the previous `Math.PI` offset.

The desktop demo screenshot shows `WALK_FORWARD` while the third-person camera is behind the robot, so the visible back is expected for a correctly forward-facing character; the model's backpack is on the camera-facing side while its movement direction is toward the scene center. The mobile demo shows the same GLB mesh and `WALK_FORWARD` state with the joystick and Jump/Crouch/Run controls still present. No map, UI, weapon, enemy, or movement-vector changes were made.

## STEP 2 — TPS基本射撃

- 単一の3D ARC PULSE RIFLEを追加し、RobotExpressive GLBの右手Bone由来Weapon Socketへ親子付けした。移動、走行、ジャンプ、しゃがみ時もSocket階層に追従する構造にした。
- PCのRMB Aim／LMB Fire／R Reload、モバイルのAIM／FIRE／RELOADをInputSnapshotへ接続した。Aim時は肩越し距離、クロスヘア、速度低下、上半身保持姿勢、カメラリコイルを適用した。
- 中央カメラForwardからRayを発生させ、練習ターゲット上のAimPointを取得し、銃口originからAimPointへ射撃方向を再計算した。移動ベクトルは反転していない。
- 5体の3D訓練ターゲットを追加し、HP 100、Damage 25、4発破壊、Hit Marker、Impact Torus、破壊イベントを実装した。
- 30／120弾薬、長押し連射、0.145秒間隔、リロードロック、トレーサー、マズルフラッシュ、発射音、カメラリコイルを実装した。
- RobotExpressive GLBは20 Mesh・2 Skeletonとしてロードされることを確認した。PBRシェーダー経路の描画失敗に備え、実Mesh／Skeletonを維持したままStandardMaterialフォールバックを適用した。
- PC（1280x720）とモバイル（390x844）のデモ画面で、STEP 2 HUD、クロスヘア、5体ターゲット、実3D Humanoid、タッチボタン、左ジョイスティックを確認した。TypeScriptチェックと本番ビルドは成功。
- 既存のマップ、三人称カメラ、WASD、モバイル移動、ジャンプ、しゃがみ、ダッシュは維持した。敵AI、複数武器、アイテム、建築、ストーム、オンライン対戦はSTEP 2では追加していない。

## モバイル射撃入力バグ修正

今回の原因は、TouchInputManagerの`isActive()`が移動・視点・Jump／Crouch／Runだけを判定し、AIM・FIRE・RELOADの状態を無視していたことだった。GameWorldは`touchInput.isActive()`がfalseの場合にPC入力へフォールバックしていたため、停止中に戦闘ボタンだけを押すと、ボタンイベント自体が状態を変更していてもゲーム更新へ届かなかった。

修正では、`isActive()`へ`aiming`、`firing`、`reloadPressed`を追加した。ボタンはPointer Eventsの`pointerdown`／`pointerup`／`pointercancel`を使い、`preventDefault()`、`stopPropagation()`、Pointer Capture、`touch-action:none`を適用した。これによりAIMは押下中だけtrue、FIREは押下中だけtrue、RELOADはワンショット入力として既存のPlayerController／WeaponSystem経路へ渡る。ボタン操作がCanvasの右スワイプ視点へ伝播しないことも確認した。

AIM／FIRE／RELOADの押下時には、それぞれ`AIM INPUT OK`、`FIRE INPUT OK`、`RELOAD INPUT OK`を約1秒表示する一時デバッグ表示を追加した。PCのRMB／LMB／R入力経路は変更していない。モバイル390x844画面で、左ジョイスティック、右側6ボタン、HUD、クロスヘア、既存3Dプレイヤーを確認し、TypeScriptチェックと本番ビルドは成功した。見た目、モデル、マップ、移動、カメラ、武器仕様は変更していない。

## 命中時クロスヘア色フィードバック

ターゲットへの弾丸命中時に既存の`showHitMarker()`から中央`.crosshair`へ`hit`クラスを追加し、120msだけ赤色へ変化させるようにした。通常の白色クロスヘア、既存のHit Marker、命中時Impact表示は維持される。赤色状態では各照準線へ`#ff4d5e`と軽い赤い発光を適用し、通常状態へ自動復帰する。

TypeScriptチェック、本番ビルド、STEP 2 PC画面を確認済み。移動、カメラ、武器、入力、マップ、UI構造は変更していない。

## ゲーム状態・Pitch・遠距離照準修正

トップ画面とアバター選択画面では、モバイル操作UIをDOMに保持したまま`is-hidden`で非表示・非操作化し、`playing`状態のときだけ`is-playing`で表示する構造にした。入力アダプターの初期化時にボタン要素が存在するため、ゲーム開始後もタッチリスナーが確実に維持される。

CameraControllerはモバイル右画面ドラッグの`lookY`を既存経路のまま受け、Pitchを約-60度から+70度へ制限した。YawとPitchはカメラへだけ適用し、プレイヤー本体の上下回転は行わない。Aim中も同じPitchを使用する。

射撃は`MAX_SHOOT_DISTANCE = 250`相当の最大射程でカメラ位置から前方Rayを作り、ターゲット命中地点または最大射程地点をAimPointとする。銃口からAimPointへ射撃方向を計算し、Tracerも銃口からAimPointまで描画する。訓練ターゲットは近距離18〜20、中距離48〜52、遠距離88へ配置し、遠距離検証を可能にした。

型チェック、本番ビルド、390x844のトップ画面とプレイ画面を確認した。トップ画面ではジョイスティックと戦闘ボタンが表示されず、`/?demo`では表示される。既存の移動・ジャンプ・しゃがみ・ダッシュ・AIM・FIRE・RELOADの実装は変更していない。

## モバイルカメラYaw反転・Pitch拡張

TouchInputManagerのモバイルsnapshotだけを調整し、`lookX`を負号反転して右スワイプで左を見る・左スワイプで右を見る操作へ変更した。`lookY`は2.05倍にして、親指1〜2回のスワイプで十分な上下角度を得られるようにした。CameraControllerのPitch制限は約-1.05〜+1.22ラジアン（約-60°〜+70°）を維持し、Pitchはカメラの注視点と位置だけへ適用してプレイヤー本体を傾けない。

上スワイプは既存の符号を維持して上を見る、下スワイプは下を見る。斜めスワイプはYaw／Pitchを同時に更新する。InputManagerのPCマウス、WASD、左ジョイスティック、PlayerController、Aim、Fire、Raycastは変更していない。モバイルAIM中の画面、TypeScriptチェック、本番ビルドを確認済み。

## STEP 3 — 敵AI基本戦闘

STEP 3を起動モードに切り替え、敵を3体（RUSTJAW、VEIL、ANKER）だけ生成した。各敵は3Dメッシュ、非表示Collider、HP100、移動速度、攻撃能力、EnemyStateを持つ。状態はIDLE→PATROL→ALERT→CHASE→ATTACK、被撃破時DEADへ遷移する。距離44以内と簡易障害物視界判定で発見し、最後に見た位置を7秒追跡した後にPATROLへ戻る。障害物押し出しと敵同士の簡易分離を適用した。

敵攻撃は射程25、15ダメージ、約0.72秒間隔。STEP 3ではプレイヤーシールドを0、HPを100として敵弾を実HPへ接続した。被弾時にHPバー減少、画面赤フラッシュ、Hit Directionマーカー、Camera反応を表示する。HP0でPLAYER DEAD、入力・移動・射撃停止、敵の攻撃対象解除、GAME OVER結果画面、RETRYを表示する。

プレイヤーのDamage25は敵HP100へ接続し、4発でDEAD。死亡時は攻撃・移動・Colliderを停止し、敵モデルを倒れた姿勢で残す。撃破時にELIMSを1増加する。PC 1280x720とモバイル390x844のSTEP 3デモを確認し、敵表示、プレイヤーHP減少、HP／ELIMS HUD、既存Aim／Fire／Reload UI、PLAYER DEAD／RETRYを確認した。TypeScriptチェックと本番ビルドも成功。大量敵、ボス、アイテム、建築、ストーム、オンライン対戦は追加していない。

## STEP 3 戦闘テストバランス調整

テスト用定数として`PLAYER_MAX_HP = 300`、`PLAYER_WEAPON_RANGE = 500`、`PLAYER_WEAPON_DAMAGE = 25`、`ENEMY_ATTACK_RANGE = 25`、`ENEMY_ATTACK_DAMAGE = 10`、`ENEMY_ATTACK_INTERVAL = 1.15`を追加した。STEP 3プレイヤーHPは300、シールド0で初期化し、HudControllerは`hp / maxHp`でHPバーを描画するため、300を最大値として正しく連動する。

GOD MODEはHUD右下の小さな`GOD: OFF/ON`ボタンから切替可能。ONでも敵弾の衝突、被弾フラッシュ、方向表示、`-10 HP (GOD BLOCKED)`イベントは発生するが、実HPは減少しない。OFFでは通常通りHPが10減少する。敵への命中時は`-25 HP`をイベントフィードへ表示する。

プレイヤー射撃の中央Raycastは500単位まで延長し、Tracerは命中地点または500単位のAimPointまで描画する。敵攻撃の射程25・間隔1.15秒はプレイヤー射程と独立している。敵3体はプレイヤー位置からNear／Medium／Far相当の配置を維持し、遠距離射撃テストが可能な状態にした。

390x844モバイル画面で敵表示、HPバー、複数の`-10 HP`表示、GOD切替、既存Aim／Fire／Reload／移動UIを確認した。TypeScriptチェックと本番ビルドに成功。グラフィック、モデル、武器モデル、マップ、新しい敵AI、アイテム、武器追加は変更していない。

## 敵ダメージ処理修正

敵Combatantの初期シールドを0へ固定し、`ENEMY_MAX_HP = 100`を敵生成・頭上HPラベルへ統一した。`PLAYER_WEAPON_DAMAGE = 25`で、プレイヤーの中央Raycastは敵Collider metadataを直接取得し、対象Rivalの`applyDamage(25)`へ接続する。これによりHPは100→75→50→25→0となる。命中時はHit Marker、Impact、`-25 HP`イベントを表示する。

敵Colliderには`enemyId`を付与し、死亡済みRivalは`containsPoint()`と`applyDamage()`の両方で拒否する。HP0ではDEAD、攻撃・追跡・移動停止、Collider停止、倒れた姿勢、ELIMS+1を実行し、後続射撃でELIMSが増えない。プレイヤー弾の表示用Projectile寿命もPLAYER_WEAPON_RANGE／速度から計算し、長距離の実弾到達制限を解消した。

敵頭上にはDynamicTextureのビルボードHPラベルを追加し、敵名と現在HP／100を表示する。TypeScriptチェックと本番ビルドに成功し、PC STEP 3画面で敵3体、頭上HPラベル、プレイヤーHP、既存HUD、敵弾イベントを確認した。既存の移動、カメラ、AIM、FIRE、RELOAD、敵AI、マップ、モデル、UIデザインは維持した。

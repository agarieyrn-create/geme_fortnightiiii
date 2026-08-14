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

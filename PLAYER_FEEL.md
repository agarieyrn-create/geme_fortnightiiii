# Player Feel Pass

## Runtime contract

PC入力とTouch入力は別アダプターとして実装し、両方とも同一の`InputSnapshot`を返す。`PlayerController`は入力元を知らず、カメラのforward/right、加速度、減速度、回転補間、ジャンプ物理、しゃがみCollider、アニメーション状態だけを処理する。

## Tuned parameters

| Parameter | Value | Intent |
|---|---:|---|
| Walk speed | 4.8 | 軽快だが滑りすぎない巡回速度 |
| Sprint speed | 8.2 | マップを横断できる走行速度 |
| Crouch speed | 2.35 | 姿勢変化が操作に反映される低速 |
| Ground acceleration | 18 | 入力に対する応答性 |
| Ground deceleration | 22 | 指を離したときの停止感 |
| Air acceleration | 4.5 | 空中制御を限定 |
| Rotation smoothing | 13 | 瞬間回転を避ける |
| Jump velocity | 7.4 | 明確なJump StartとFall |
| Gravity | 20.5 | 着地までの自然な弧 |
| Camera smoothing | 10 | 走行時も遅れすぎない追従 |
| Camera sensitivity | 0.0021 | PCマウスとタッチの共通基準 |

## Humanoid rig

頭、首、胴体、骨盤、左右上腕、左右前腕、左右手、左右太腿、左右下腿、左右足、肩甲、膝甲、バックパックを階層化した低ポリゴン人型リグとして持つ。各パーツはTransformNode配下にあり、AnimationControllerは手足の位相、背骨の傾き、腕の振り、着地の圧縮、しゃがみ姿勢を同じリグへ適用する。生成レンダーは選択画面用の肖像として保持し、プレイ中は実3Dリグを使用する。

## Motion state machine

`IDLE`、`WALK_FORWARD`、`WALK_BACKWARD`、`STRAFE_LEFT`、`STRAFE_RIGHT`、`RUN`、`JUMP_START`、`JUMP_LOOP`、`FALL`、`LAND`、`CROUCH_IDLE`、`CROUCH_WALK`、`AIM`、`FIRE`を共有状態として扱う。歩行は入力ベクトルの前後左右成分から判定し、走行はSprint入力と速度から判定する。状態遷移時に短いブレンド係数を使い、足の位相とルート姿勢が急に切り替わらないようにする。

## Touch contract

左半分に仮想ジョイスティックを表示し、外周を越えない正規化ベクトルを移動入力として返す。右半分のドラッグはカメラdeltaへ変換する。右下の3つのアクションボタンはJump、Crouch、Sprintを同じInputSnapshotへ接続する。タッチ入力はPointer Eventsで実装し、マウスと競合しないようpointerIdごとに管理する。

## Verification matrix

| Check | Result |
|---|---|
| 人型3Dキャラクター | 階層化された頭・首・胴体・腕・手相当のガントレット・脚・足・装甲を使用 |
| Idle／Walk／Run | `AnimationController`の位相ブレンドと速度別ストライドを使用 |
| 前後・左右移動 | カメラforward/rightと入力成分から状態を判定 |
| 方向転換 | 移動方向へ13rad/sの角度補間 |
| Orbitカメラ | マウスdeltaとタッチ右スワイプを共通カメラへ接続 |
| Jump Start／Loop／Fall／Land | 重力、接地、着地タイマー、状態遷移を使用 |
| Crouch | 姿勢、速度、Capsule Collider高さを切替 |
| PC入力 | InputManagerがWASD、Shift、Space、C／Ctrl、マウスを担当 |
| モバイル入力 | TouchInputManagerが左スティック、右スワイプ、3ボタンを担当 |
| 既存UI・マップ | ミニマップ、地形、HUD骨格を維持し、モバイル操作だけ追加 |

PC幅とスマートフォン幅の`/?demo`を視覚確認し、型チェック・本番ビルド・ブラウザコンソール確認を完了した。

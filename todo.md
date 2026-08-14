# キャラクター品質改善

- [x] 現在のゲーム内プレイヤーと敵の見え方を確認し、モデル・構図・ライティングの問題点を記録する。
- [x] 独自のプレイヤーキャラクターを3体、敵キャラクターを3体、統一したアート方向で生成する。
- [x] キャラクター選択画面を設計し、選択内容をゲーム開始時のプレイヤー外観へ反映する。
- [x] 敵ごとに輪郭、カラー、装備、行動シルエットを差別化してゲームへ統合する。
- [x] 開始画面、選択画面、実プレイ画面を視覚検証し、人物の品質と識別性を調整する。
- [x] 型チェック、本番ビルド、実行ログ確認を行い、改善版を保存する。

## 添付指示書の反映

- [x] 添付ファイルの内容を読み取り、機能・UI・演出・アセット要件へ分解する。
- [x] 指示書に必要な追加ビジュアルとゲーム要素を準備する。
- [x] 指示内容をStormfallへ実装し、既存機能との整合性を保つ。
- [x] 実機画面、レスポンシブ表示、型チェック、本番ビルド、ログを検証する。
- [ ] 反映版をチェックポイントとして保存する。

---

## 反映結果

- [x] 要件整理完了
- [x] アセット準備完了
- [x] 実装完了
- [x] 検証完了
- [ ] 保存・共有完了

---

## 構造再設計

- [x] 現行のGameWorld集中構造と添付仕様のPhase 1〜9を差分整理する。
- [x] InputManager、Player、CameraController、AnimationController、WeaponSystem、EnemyAI、WorldBuilder、HudControllerのデータ契約を設計する。
- [x] 既存のGameWorld集中ロジックを新しい責務分離構造へ移行する。
- [x] Phase 1〜9の操作可能性を段階的に検証し、実行時エラーを修正する。
- [ ] 再設計版をビルド・画面確認し、チェックポイントとして保存する。

## STEP 1 — 3D TPS基盤の再構築

- [x] 現行の正面固定・射撃中心の経路を確認し、STEP 1で停止する機能範囲を確定する。
- [x] 3Dプレイヤーリグ、カメラ基準移動、自然な方向転換、Orbitカメラ、重力、地面判定、しゃがみCollider、ダッシュの契約を設計する。
- [x] STEP 1では射撃、敵、アイテム、嵐ダメージを停止し、3Dフィールド探索に集中できるプレイモードへ作り直す。
- [x] 地面、丘、木、岩、建物、壁、道、高低差を3DオブジェクトとColliderとして配置する。
- [x] PC・モバイル表示、型チェック、本番ビルド、実機操作と画面視認性を検証する。
- [ ] STEP 1完成版をチェックポイントとして保存する。

## Player Feel Pass — キャラクターと操作感の全面改善

- [x] 現行プレイヤーリグ、アニメーション、PC入力、カメラ、モバイル入力の14項目との差分を確定する。
- [x] 人型3DリグとIdle／Walk／Run／Jump／Fall／Land／Crouch／Aim／Fire状態のデータ契約を設計する。
- [x] PCとモバイルの入力アダプターを分離し、同じPlayerControllerへ接続する。
- [x] プレイヤーの加速・減速・回転補間・ジャンプ物理・しゃがみCollider・カメラ平滑化を調整する。
- [x] 左スティック、右スワイプ、ジャンプ・しゃがみ・ダッシュボタンをモバイルHUDへ実装する。
- [x] 14項目をPC・モバイルで検証し、既存マップ・ミニマップ・UIを壊していないことを確認する。
- [ ] 改善版をビルド・保存し、次のゲームシステム追加前の基盤として共有する。

## Real 3D Humanoid Pass

- [x] 2D画像・Billboard・Spriteのプレイヤー表示経路を特定し、プレイ中の使用を停止する。
- [x] 軽量なGLB／GLTF Humanoidモデル、Skeleton／Bones、Idle・Walk・Run・Jump・Fall・Land・Crouchアニメーションを準備する。
- [x] Babylon.jsのAssetContainer／SceneLoaderで本物の3D MeshとAnimationGroupを読み込む。
- [x] PlayerControllerの状態をAnimationGroupへクロスフェード接続し、移動方向へ3Dモデル本体を回転させる。
- [x] 正面・背面・左右側面・斜めを360度確認し、PC・モバイルで描画する。
- [x] 型チェック、本番ビルド、ブラウザログ確認後に改修版を保存する。

## Forward Axis 修正

- [x] GLBのローカルForward軸、modelRoot初期回転、player rotation計算を確認する。
- [x] 移動ベクトルを反転せず、モデル側の回転補正だけを最小変更する。
- [x] 前後左右・斜め・180度ターン・カメラ回転を実画面で検証する。
- [x] マップ、UI、武器、敵、ゲームシステムを変更しない。

## STEP 2 — TPS基本射撃

- [x] 既存の3D移動、方向転換、走行、ジャンプ、しゃがみ、三人称カメラ、モバイルジョイスティックを維持する。
- [x] アサルトライフル型3D武器をWeapon Socket／手のBoneへ追従させ、移動・ジャンプ・しゃがみ中も保持させる。
- [x] Armed Idle／Armed Walk／Armed Run／Aim／Fire／Reload状態を実装する。
- [x] PC右クリックとモバイルAIMで滑らかな肩越し視点、速度低下、クロスヘア、銃構えを実装する。
- [x] 画面中央からカメラ前方へRaycastし、AimPointから銃口へ射撃方向を求める。
- [x] Magazine 30、Reserve 120、Damage 25、長押し連射、R／RELOADリロードを実装する。
- [x] Muzzle Flash、発射音、Bullet Tracer、Weapon／Camera Recoil、Hit Marker、Impact Effectを実装する。
- [x] HP 100の3D練習ターゲットを5体配置し、4発命中で破壊できるようにする。敵AIは追加しない。
- [x] PC・モバイルでAim・Fire・Reload・移動併用を検証し、16項目完了後に保存する。
- [x] 今回は敵AI、敵攻撃、複数武器、武器切替、アイテム、宝箱、インベントリ、建築、ストーム、オンライン対戦を追加しない。

## モバイル射撃入力バグ修正

- [x] AIM／FIRE／RELOADボタンの実イベント、InputSnapshot、GameWorld処理経路を確認する。
- [x] Pointer Events、preventDefault、stopPropagation、touch-action、z-indexを確認する。
- [x] AIM長押し、FIRE長押し連射、RELOADを既存ロジックへ接続する。
- [x] AIM INPUT OK／FIRE INPUT OK／RELOAD INPUT OKの一時表示を追加する。
- [x] モバイル・PC操作、カメラ競合、ジョイスティック、JUMP／CROUCH／RUNを検証する。
- [x] 見た目、モデル、マップ、移動、カメラ、武器仕様を変更せず保存する。

## カメラ・遠距離照準・ゲーム状態修正

- [x] menu／playing状態に応じてゲーム操作UIを表示し、トップ画面とアバター選択画面では隠す。
- [x] モバイルの右画面ドラッグでYaw／Pitchを同時に更新し、Pitchを上下限で制限する。
- [x] Aim中もPitchを維持し、高低差のある照準を可能にする。
- [x] カメラ位置から最大射程までRaycastし、AimPointを銃口射線へ渡す。
- [x] Bullet Tracerを命中地点または最大射程地点まで表示し、実射程と分離する。
- [x] 近・中・遠ターゲットを配置して遠距離照準・命中を検証する。
- [x] 既存の移動・ジャンプ・しゃがみ・ダッシュ・AIM・FIRE・RELOADを回帰確認する。

## モバイルカメラYaw反転・Pitch拡張

- [ ] TouchInputからCameraControllerへのdeltaX／deltaY経路と符号を確認する。
- [ ] モバイルYawだけを反転し、Pitch感度を上げ、約-60°〜+70°へ制限する。
- [ ] 停止状態とAIM状態で左右・上下・斜め8方向を確認する。
- [ ] WASD、左ジョイスティック、進行方向、Fire、Raycast、PCマウスを反転させない。
- [ ] カメラ修正版をビルド・保存する。

## STEP 3 — 敵AI基本戦闘

- [x] EnemyDirector・Rival・Player・射撃・HUD・ゲーム状態の既存経路を確認する。
- [x] 敵を3体だけ配置し、3Dモデル、Collider、HP100、速度、攻撃能力、AI Stateを持たせる。
- [x] IDLE／PATROL／ALERT／CHASE／ATTACK／DEADの状態遷移を実装する。
- [x] 距離・視界Raycastで発見し、追跡、射程内攻撃、追跡解除、簡易障害物回避を実装する。
- [x] 敵弾のプレイヤー命中、HP100、HPバー、Damage Flash、Hit Direction、Camera反応を接続する。
- [x] プレイヤー死亡、移動・射撃停止、敵攻撃対象解除、GAME OVER、RETRYを実装する。
- [x] プレイヤー射撃で敵HPが減り、4発で死亡、DEAD、当たり判定停止、ELIMS増加を実装する。
- [x] 敵同士の重なりを分離し、PC・モバイルで16項目を検証する。
- [x] 大量敵、ボス、複数武器、アイテム、宝箱、インベントリ、建築、ストーム、オンライン対戦は追加しない。

## STEP 3 戦闘テストバランス調整

- [x] PLAYER_MAX_HPを定数化して300へ変更し、HPバーを最大値300へ接続する。
- [x] 敵ダメージを10、敵射撃間隔を1.0〜1.5秒、敵攻撃射程を30以下へ調整する。
- [x] DEBUG GOD MODEを追加し、被弾演出を維持したままHP減少だけを無効化する。
- [x] PLAYER_WEAPON_RANGEを500へ延長し、Tracerを命中地点まで表示する。
- [x] Near／Medium／Farの3距離へ敵を配置し、プレイヤー射程と敵攻撃射程を分離する。
- [x] -10 HP／-25 HPのダメージ表示を追加する。
- [x] PC・モバイルでHP300、GOD MODE、遠距離命中、敵攻撃バランスを検証する。
- [x] グラフィック、モデル、武器モデル、マップ、新しい敵AI、アイテム、武器追加は変更しない。

## 敵ダメージ処理修正

- [ ] ENEMY_MAX_HP=100、PLAYER_WEAPON_DAMAGE=25、敵ColliderからtakeDamage()までの経路を確認する。
- [ ] 敵頭上へ現在HP／最大HPを表示し、1発75、2発50、3発25、4発0を確認できるようにする。
- [ ] HP0でDEAD、移動・追跡・射撃・ダメージ判定を停止し、簡易死亡姿勢へ遷移する。
- [ ] 死亡済み敵への追加射撃でELIMSが二重加算されないようにする。
- [ ] Near／Medium／FarでRaycast Hit、HP減少、遠距離命中を検証する。
- [ ] 既存の移動、カメラ、射撃、敵AI、マップ、モデル、UIを変更しない。

## 移動入力解除バグ修正

- [x] TouchInputManagerのmovementPointerId、pointerup／pointercancel、touchend／touchcancelを確認する。
- [x] Pointer Captureを終了時にreleaseし、window blur／visibilitychangeで全移動入力をリセットする。
- [x] InputManagerのkeyupとPlayerControllerの毎フレームゼロ入力を確認する。
- [x] 一時Move Input表示を追加し、前後左右・複数タッチ・FIRE／AIM併用後の停止を検証する。
- [x] 敵AI、敵HP、射撃、カメラ、武器、グラフィック、マップ、UIデザインは変更しない。

## キャラクターモデル固定修正

- [x] selectedCharacterの選択・開始・RETRY経路とHumanoidロード箇所を確認する。
- [x] ゲーム開始時にCharacterVisualを一度だけ生成・ロードし、PlayerRootへ固定する。
- [x] Idle／Walk／Run／Jump／Crouch／Aim／Fire／Reload／被弾／撃破中にモデルを再生成しない。
- [x] 非同期ロード競合、フォールバック切替、RETRY後のキャラクター変更を防止する。
- [x] PC・モバイルで継続シナリオとビルドを確認する。
- [x] 移動、カメラ、射撃、敵AI、HP、マップ、グラフィック品質、新機能は変更しない。

## STEP 4 — 探索・拾得・装備

- [ ] 現行WeaponSystem、GameWorld、HUD、PC／モバイル入力、Weapon Socket経路を確認する。
- [ ] Assault Rifle／Shotgun／SMGの3Dアイテムを配置し、近接優先対象とPICKUP表示を実装する。
- [ ] 初期武器なし、最大3スロット、武器取得・装備・切替・武器性能切替を実装する。
- [ ] Medium Ammo／Shells／Light Ammo取得とReserve Ammo更新を実装する。
- [ ] Med Kit拾得、3秒使用、HP+50、最大HP制限、途中移動制御を実装する。
- [ ] E／PICKUP、1／2／3、モバイルスロット、Med Kit入力を統合する。
- [ ] 武器なしFIRE停止、3種射撃、AIM／FIRE／RELOAD／敵HP／Hit Markerを検証する。
- [ ] PC・モバイルでSTEP 4の18項目と既存機能を検証する。
- [ ] 武器レアリティ、10種以上、宝箱、ドロップ率、アタッチメント、防具、クラフト、建築、ストーム、オンライン対戦、高品質グラフィックは追加しない。

## 今回 — キャラクター固定・モバイルUI整理・日本語化

- [ ] selectedCharacterIdを選択時からRetryまで一貫して保持する
- [ ] プレイ中のアバター変更・後発ロード・フォールバック上書きを防止する
- [ ] モバイル常時操作をジョイスティック、うつ、ジャンプ、しゃがむ、ねらうへ整理する
- [ ] リロードは必要時だけ小さく表示する
- [ ] ひろうは対象アイテムが近い時だけ表示する
- [ ] 回復は所持時だけ小型表示する
- [ ] 武器スロットを小型HUD兼タップ切替へ変更する
- [ ] Move Inputなど一時デバッグ表示を通常画面から除去する
- [ ] ゲーム内表示を子ども向けの日本語へ統一する
- [ ] 型チェック、ビルド、PC・モバイル表示を確認する

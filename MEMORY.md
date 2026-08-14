# Stormfall 実装メモ

## STEP 8 くらやみの洞窟

- 洞窟は画面確認で暗すぎたため、環境光・松明・プレイヤー追従ライト・地面と玄武岩の明度を上げた。暗い雰囲気を残しつつ、地面・壁・琥珀の松明・ティールの鉱石が判別できる値を採用している。
- 洞窟開始時の案内文はダンジョンIDごとに切り替える。遺跡用の開始文が出ないよう、`isCaveDungeon` を最優先する。
- STEP 8のPC／モバイル確認では、洞窟の入口・目的表示・初期武器・端寄せモバイル操作を確認済み。トラップ、スイッチ、ゴルムの進行は同じ`GameWorld`の専用分岐で管理する。

## プレイテスト版 v0.1

- 初回チュートリアルは`ProgressionData.tutorialSeen`へ保存し、ゲーム中は`GameWorld`のローカル送信済みセットで重複表示を防ぐ。チュートリアル既読の保存だけではReactのゲームシーンを再生成しない。
- `?debug=1`指定時だけ、現在ダンジョン・エリア・HP・武器・コイン・強化Lv・FPSを表示する。通常プレイには開発情報を出さない。
- 複数パスの並行画面確認ではBabylonの初期描画が暗く映る場合がある。単独の`?play=1&dungeon=ruins&debug=1`確認では遺跡の地形、敵、HUD、開発情報が描画されることを確認した。

## STEP 9 グラフィック刷新

- 画質は`ProgressionData.graphicsQuality`へ`light`／`standard`／`pretty`として保存する。モバイルも既定は`standard`で、`light`では環境光のみ、`standard`では色調・FXAA・ごく弱いBloom、`pretty`では追加のDirectional Shadowを有効にする。
- 生成済みの遺跡・森・洞窟地表テクスチャは`GameWorld.createTerrainTexture()`から直接参照する。ダンジョンのルール、当たり判定、進行状態とVisual Layerを混ぜない。
- 画面確認では`?play=1&dungeon=ruins`の初期描画に、スクリーンショット環境由来のBabylon vertex shader errorが継続して記録される。ただし型チェックと本番ビルドは通過し、ゲーム画面自体は描画される。ログ上の同エラーは既知の並行キャプチャ由来として扱い、機能退行を示す別エラーと区別する。
- GLBは`HumanoidModelController.loadGeneration`で固定し、パレットとExplorer Gearのみを載せる。モデル本体のロードし直しや、ゲーム中のアバター差し替えは再導入しない。

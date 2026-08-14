# Assets

**Art direction:** 太陽光のある砂岩の浮遊群島と、深い群青の空を横切る電磁嵐を対比する、シネマティック・アーケードSF。危険はストーム・ティール、補給物資は琥珀、敵対的な攻撃は朱赤で識別する。輪郭が明瞭な中密度3Dジオメトリと、読み取れるHUDを優先する。

## Visual Reference

| Name | Description | Size | Image |
|---|---|---|---|
| stormfall-reference | 肩越しカメラ、砂岩の渓谷、航法パイロン、収縮嵐、戦術HUDを含む完成画面の基準 | 1920×1080、フルスクリーン参照 | `/manus-storage/stormfall-reference_00af8a30.png` |
| mayoi-forest-reference | 分岐する森道、巨木、苔岩、草、青緑の霧、隠し宝箱を含む「まよいの森」の視覚基準 | 16:9、ゲーム内環境参照 | `/manus-storage/mayoi-forest-reference_d98ef10a.png` |
| mayoi-guardian-reference | 根・石・苔・ティールのコアを持つ森のガーディアンのシルエットと攻撃の視覚基準 | 3:4、ボス参照 | `/manus-storage/mayoi-guardian-reference_0099b23a.png` |
| kurayami-cave-reference | 暗い玄武岩の洞窟、ティールの鉱石、琥珀のランプ、予告付き床トラップを含む「くらやみの洞窟」の視覚基準 | 16:9、ゲーム内環境参照 | `/manus-storage/kurayami-cave-reference_652c556d.png` |
| gorum-reference | ティールの鉱石亀裂と琥珀コアを持つ「岩の王 ゴルム」のシルエットと攻撃の視覚基準 | 1:1、ボス参照 | `/manus-storage/gorum-reference_88e81959.png` |
| stormfall-step9-style-reference | STEP 9の共通Visual Layer基準。明るい探索感、温かい石と冷たいティール、やわらかな陰影、遠景の大気感を持つ独自スタイライズド3D TPS | 16:9、共通の色・光・素材参照 | `/manus-storage/stormfall-step9-style-reference_b7256888.png` |

## UI & Brand

| Name | Description | Size | Image |
|---|---|---|---|
| stormfall-logo | 稲妻で割れた円環と地平線で構成する透過ブランド記号 | 256×256 px | `/manus-storage/stormfall-logo-fixed_bf9eea9a.png` |

## Textures

| Name | Description | Size | Image |
|---|---|---|---|
| stormfall-terrain-atlas | 砂岩、玄武岩、土、浅瀬を含むシームレス地表マテリアル | 2m タイル相当 | `/manus-storage/stormfall-terrain-atlas_79eec8f1.png` |
| stormfall-ruins-ground-texture | 角の取れた砂岩の敷石、控えめな苔と小石を持つ遺跡用の手描き風反復地表 | 1:1、遺跡の床・道 | `/manus-storage/stormfall-ruins-ground-texture_441a71b0.png` |
| stormfall-forest-ground-texture | 草、落ち葉、根、土を組み合わせた森の小道用の手描き風反復地表 | 1:1、森の地面・分岐路 | `/manus-storage/stormfall-forest-ground-texture_6eb34a85.png` |
| stormfall-cave-ground-texture | 玄武岩、微かなティール鉱脈、琥珀色の粉塵を持つ洞窟用の手描き風反復地表 | 1:1、洞窟の床・岩場 | `/manus-storage/stormfall-cave-ground-texture_32b8bd63.png` |

## Props

| Name | Description | Size | Image |
|---|---|---|---|
| stormfall-supply-beacon | 琥珀の信号灯とティール色ホログラムを持つ補給カプセルの視覚参照 | 高さ 1.6m、幅 1.2m | `/manus-storage/stormfall-supply-beacon-fixed_fefc7346.png` |

## Character Renders

| Name | Description | Size | Image |
|---|---|---|---|
| kairo | タン色の探検コートとティールの腕甲を備えたリフトレンジャー | 3:4、フルボディ | `/manus-storage/stormfall-player-anchor_21f4d359.png` |
| haze | ティールの肩甲と灰色フィールドジャケットを着たストームスカウト | 3:4、フルボディ | `/manus-storage/stormfall-haze-final_4236e3e5.png` |
| vanta | オフホワイトのポンチョと機械腕を持つフィールドエンジニア | 3:4、フルボディ | `/manus-storage/stormfall-vanta-final_dc45be78.png` |
| rustjaw | 錆赤のサルベージ装甲と銅の顎部を持つ敵対ライバル | 3:4、フルボディ | `/manus-storage/stormfall-rustjaw-final_97dfa9cd.png` |
| veil | 深紅のケープと狙撃装備を持つ敵対インフィルトレーター | 3:4、フルボディ | `/manus-storage/stormfall-veil-final_829eb401.png` |
| anker | 橙色のサバイバルクロークと前腕シールドを持つ敵対ブルワーク | 3:4、フルボディ | `/manus-storage/stormfall-anker-final_a22065d6.png` |

## Procedural Geometry

| Name | Description | Size | Visual role |
|---|---|---|---|
| player-ranger | タン色のユーティリティコートとティールの腕甲を持つ探索者 | 高さ 1.8m | プレイヤーの三人称アバター |
| rival-scavenger | 錆赤と灰色のフィールドギアを持つライバル | 高さ 1.8m | NPC対戦者 |
| navigation-pylon | 三本脚の黒い航法パイロン | 高さ 6m | 遠距離ランドマークと遮蔽物 |
| storm-ring | 半透明のティール色トーラスと地表リング | 初期半径 85m | 収縮する危険境界 |

## TPS改修でのアセット利用方針

添付仕様の優先順位に従い、キャラクターは生成済みのフルボディレンダーをアバター表示に使用し、実際の操作・当たり判定・方向転換はBabylonの階層メッシュへ保持する。射撃は新規画像に依存せず、既存のArc Pulse Rifle形状、琥珀マズルフラッシュ、ティールの弾道で即時反応を優先する。フィールドは生成済みの群島リファレンスと地表色を維持し、砂岩テクスチャ、玄武岩、地層スラブ、航法パイロン、浅い水路を手続き生成する。これにより大容量GLBを導入せず、ブラウザで安定してTPS操作を検証できる。

## STEP 9のVisual Layer利用方針

STEP 9では、既存のゲーム規則・当たり判定・ダンジョン進行と分離したまま、共通の色調、環境光、ソフトシャドウ、距離フォグ、控えめな発光を追加する。床と道にはダンジョン別の生成済み反復テクスチャを使い、石・草・木・岩・金属・鉱石は低〜中ポリゴンの手続きメッシュへ色と粗さの違いで載せる。高負荷な多数の独立ライトや高密度モデルを避け、近景の読みやすさ、子ども向けの明瞭な危険色、モバイルでの安定した操作を優先する。

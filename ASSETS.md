# Assets

**Art direction:** 太陽光のある砂岩の浮遊群島と、深い群青の空を横切る電磁嵐を対比する、シネマティック・アーケードSF。危険はストーム・ティール、補給物資は琥珀、敵対的な攻撃は朱赤で識別する。輪郭が明瞭な中密度3Dジオメトリと、読み取れるHUDを優先する。

## Visual Reference

| Name | Description | Size | Image |
|---|---|---|---|
| stormfall-reference | 肩越しカメラ、砂岩の渓谷、航法パイロン、収縮嵐、戦術HUDを含む完成画面の基準 | 1920×1080、フルスクリーン参照 | `/manus-storage/stormfall-reference_00af8a30.png` |

## UI & Brand

| Name | Description | Size | Image |
|---|---|---|---|
| stormfall-logo | 稲妻で割れた円環と地平線で構成する透過ブランド記号 | 256×256 px | `/manus-storage/stormfall-logo-fixed_bf9eea9a.png` |

## Textures

| Name | Description | Size | Image |
|---|---|---|---|
| stormfall-terrain-atlas | 砂岩、玄武岩、土、浅瀬を含むシームレス地表マテリアル | 2m タイル相当 | `/manus-storage/stormfall-terrain-atlas_79eec8f1.png` |

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

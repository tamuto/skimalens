# SkimaLens

JSONやYAMLデータを可視化するためのWebベースデータビューアツールです。

## 概要

SkimaLensは、構造化データを読み込んで直感的に参照・可視化できるフロントエンド専用ツールです。

### 主な用途

- **Claudeの会話ログ分析**: conversation.jsonファイルの内容を見やすく表示
- **ChatGPTの会話ログ**: 将来的にサポート予定
- **CloudWatchログス**: 将来的にサポート予定
- **汎用JSON/YAMLデータ**: 自由形式のデータ可視化

### 特徴

- バックエンド不要のフロントエンド専用ツール
- ファイルドロップまたはアップロードによるデータ読み込み
- TypeScript + React + Shadcn/UIによる堅牢で美しいUI
- リアルタイムデータ検索・フィルタリング機能

## セットアップ

依存関係をインストール:

```bash
npm install
```

## 開発

開発サーバーを起動:

```bash
npm run dev
```

本番用ビルド:

```bash
npm run build
```

## 技術スタック

- **フレームワーク**: React 19 + TypeScript
- **ビルドツール**: Rsbuild (Rspack)
- **ルーティング**: TanStack Router
- **UI**: Shadcn/UI + Tailwind CSS
- **アイコン**: Lucide React + Radix UI Icons

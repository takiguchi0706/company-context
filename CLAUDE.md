# valucan株式会社 - 会社ルートCLAUDE.md

## 会社概要
- オーナー：valucan
- ミッション：AIを活用した一人会社の運営
- メインプロダクト：AIエージェントダッシュボード（04_product/dashboard/）
- 副プロダクト：ひよこAI・management-qa（04_product/配下）

## フォルダ構成
- 01_secretary/        秘書室（Notion MCP中枢）
- 02_planning/         企画・戦略部
- 03_design/           デザイン部
- 04_product/          プロダクト部
  - dashboard/         AIエージェントダッシュボード
  - hiyoko-ai/         ひよこAI（育児記録・AI相談）
  - management-qa/     QAテスト管理ツール
- 05_content/          コンテンツ部（note・X）
- 06_automation/       自動化部
- 07_finance/          収益・財務部
- 08_marketing/        マーケティング部
- 09_analytics/        データ分析部
- 10_legal/            法務・コンプライアンス部
- 11_qa/               QA部

## 技術スタック
- ダッシュボード：Next.js (App Router) + Supabase + Vercel
- AI：Claude API (claude-sonnet-4-20250514)
- 認証：Supabase Auth
- ひよこAI：React Native + Expo SDK 55

## 運用ルール
- Claude Codeは各部署フォルダから起動し、その部署のCLAUDE.mdを読む
- 全社横断の作業はルートから起動する
- Notion MCPは01_secretaryフォルダから起動する
- ファイル作成はClaude Codeに任せる（手動コピー禁止）

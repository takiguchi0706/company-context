# AIエージェントダッシュボード CLAUDE.md

## プロダクト概要
valucan株式会社の全部署AIエージェントを一元管理するダッシュボード

## 技術スタック
- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase（認証・DB・リアルタイム）
- Claude API (claude-sonnet-4-20250514)
- Vercel（デプロイ）

## 部署構成（11部署）
01_secretary / 02_planning / 03_design / 04_product /
05_content / 06_automation / 07_finance / 08_marketing /
09_analytics / 10_legal / 11_qa

## 主要機能
- ゴール入力 → 全部署一斉実行（並列・Claude API）
- 個別部署に相談（チャット継続履歴付き）
- タスク管理（完了・未完了）
- 活動ログ（実行履歴・会話・プロジェクト進捗を時系列記録）
- KPIウィジェット（項目を自分で追加・編集）
- 部署ステータス管理（稼働/休止）
- 出力のコピー・エクスポート
- Notion連携
- Webhook連携（送信先は後で設定）
- プロダクト管理（新規追加フォーム→Claude Codeプロンプト自動生成→ワンクリックコピー）
  入力項目：プロダクト名・説明/概要・担当エージェント名・テックスタック・ターゲットユーザー・リリースステータス
- Supabase Auth（ログイン必須）

## デザイン
- 明るい・ビジネスライク
- ホワイト/ライトグレー基調
- PCメイン・スマホ対応

## Supabaseテーブル（後で詳細設計）
- departments（部署マスタ）
- executions（実行履歴）
- messages（チャット履歴）
- tasks（タスク管理）
- activity_logs（活動ログ）
- kpi_items（KPI項目）
- products（プロダクトマスタ）

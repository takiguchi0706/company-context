# 設計方針・技術的な判断メモ（ADR）

## ADR-001: Next.js 16 採用

**決定**: フロントエンドに Next.js 16（App Router）+ TypeScript を採用する

**理由**:
- 既存プロダクト（company-dashboard, management-qa）と同じスタックで一貫性を保つ
- App Router の Server Components でAPIルートとページを同一プロジェクトで管理できる
- Vercel との親和性が高い

---

## ADR-002: DB無しでスタート

**決定**: 初回MVPはデータベースなし・認証なしのステートレス構成

**理由**:
- MVP最速リリースが優先
- コード解説はセッション単位で完結する（永続化の緊急性が低い）
- 将来的に Railway PostgreSQL を追加する想定（hiyoko-aiと同様のパターン）

**トレードオフ**:
- ページリロードで解説が消える（sessionStorage で一時保持）
- 複数デバイスでの継続利用不可

---

## ADR-003: agent-server 経由のAI呼び出し

**決定**: Claude API を直接呼ぶのではなく、既存の agent-server（Railway）を経由する

**理由**:
- 既存インフラの活用（Claude API キーの一元管理）
- agent-server の GitHub tools（read_file）を使って自社リポジトリのコードを読める
- company-dashboard と同じ実装パターンで開発効率が上がる

**エンドポイント**: `POST /execute-agent`
- `instruction`: ユーザーのコード + 質問
- `system_prompt`: 解説レベル×モードに応じたプロンプト
- `department`: `04_product/code-review`

---

## ADR-004: GitHub連携方式

**決定**: URL取得（パブリック）と PAT認証（プライベート）の両方に対応

**理由**:
- パブリックリポジトリ: GitHub REST API を直接 fetch（トークン不要）
- プライベートリポジトリ: `GITHUB_TOKEN` 環境変数（PAT）で認証（自社リポジトリ含む）
- 自社リポジトリパス指定: agent-server の `read_file` ツール経由（agent-server 側に GITHUB_TOKEN 設定済み）

**トレードオフ**:
- `GITHUB_TOKEN` はサーバーサイド専用（クライアントに露出しない）
- Fine-grained PAT または Classic PAT（repo権限）が必要

---

## ADR-005: SPA方式でのページ遷移

**決定**: 入力ページ → 解説ページの遷移に sessionStorage を使う

**理由**:
- コードが5000行になる可能性があり、URLパラメータではエンコード上限に引っかかる
- シンプルな実装で十分（DB不要）
- `/explain` ページは直リンク非対応（仕様として許容）

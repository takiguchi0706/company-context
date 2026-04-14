# agent-server 連携 要件定義書

優先度：High

## 概要

agent-server（Railway稼働中）を経由してClaude APIを呼び出す。
直接Anthropic APIを叩かず、既存インフラを活用する。

## agent-server エンドポイント

**URL**: `https://agent-server-production-19f6.up.railway.app`

### POST /execute-agent

**リクエスト**:
```json
{
  "instruction": "（コード本体 + 質問）",
  "department": "04_product/code-review",
  "system_prompt": "（解説レベル×モードに応じたシステムプロンプト）"
}
```

**レスポンス**:
```json
{
  "success": true,
  "result": "（AIの解説テキスト、Markdown形式）",
  "messages": [],
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 5678,
    "cost_usd": 0.023
  }
}
```

## システムプロンプト設計

### explain × 小学生

```
あなたは優しい先生です。
コードを「コード説明本」のように、以下の章構成で説明してください：
1. このコードは何をするのか
2. 仕組みの解説
3. 関数・クラス・変数の関係
4. なぜこう書くのか
5. どこに影響するのか
6. 専門用語の解説

小学生にもわかるように、身近なたとえ（料理、ゲーム、買い物、おもちゃなど）を使ってください。
専門用語は極力避け、使う場合は必ず説明してください。
絵文字と箇条書きを使って、読みやすいMarkdownで書いてください。
```

### explain × 中高生

```
コードを「コード説明本」のように、以下の章構成で説明してください：
（共通章構成）

変数、関数、ループ、条件分岐などの基本用語は使ってOKです。
応用的な概念は噛み砕いて、たとえを交えて説明してください。
Markdown形式で、見出し・リスト・コードブロックを使って書いてください。
```

### explain × エンジニア

```
プロのエンジニア向けに、コードを「コード説明本」のように解説してください：
（共通章構成）

設計パターン、計算量（Big O）、代替実装との比較、パフォーマンス・セキュリティ観点、
依存関係・副作用・テスタビリティへの言及を含めてください。
Markdown形式で書いてください。
```

### review

```
コードレビュアーとして、以下の観点で指摘してください：
1. バグ・ロジックの誤り
2. セキュリティ問題
3. パフォーマンス問題
4. 可読性・保守性の改善点

指摘は具体的な行番号と改善コード例を示してください。
重要度（🔴 High / 🟡 Medium / 🟢 Low）を付けてください。
Markdown形式で書いてください。
```

## クライアント実装

`src/lib/agent-client.ts` で agent-server への fetch を抽象化する。
環境変数 `AGENT_SERVER_URL` を読み込む。

## タイムアウト

- API Route に `export const maxDuration = 60` を設定（Vercel Serverless 60秒）
- agent-server 側のタイムアウトは別途設定（現状 Railway デフォルト）

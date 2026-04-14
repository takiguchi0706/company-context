# code-review

**書いたコードを、コード説明本のように解説してくれるツール。**

コードを貼り付けるか、GitHubのURLを入力するだけで、AIが「なぜこのコードがこう動くのか」を
小学生からエンジニアまで3段階のレベルで解説します。
解説中の疑問はその場でチャット質問できます。

## デモURL

https://code-review-kappa-rosy.vercel.app

## 機能

- **コード入力**：貼り付け / GitHub URL / 自社リポジトリパス の3種類
- **解説レベル**：🧒小学生向け / 🧑‍🎓中高生向け / 👨‍💻エンジニア向け
- **解説モード**：「解説する」「レビューする」
- **チャット質問**：解説後にその場で追加質問
- **GitHub連携**：パブリック・プライベートリポジトリ対応（PAT設定時）

## セットアップ

```bash
cd 04_product/code-review
npm install
cp .env.local.example .env.local
# .env.local を編集して環境変数を設定
npm run dev
```

## 環境変数

`.env.local` に以下を設定：

```env
AGENT_SERVER_URL=https://agent-server-production-19f6.up.railway.app
GITHUB_TOKEN=ghp_xxxxxxxxxxxx   # プライベートリポジトリ対応時のみ（repo権限必要）
```

## デプロイ（Vercel）

```bash
# 初回
vercel deploy --prod

# 環境変数の設定
vercel env add AGENT_SERVER_URL
vercel env add GITHUB_TOKEN

# 以降
vercel deploy --prod
```

## 技術スタック

- Next.js 16 + TypeScript + Tailwind CSS v4
- react-syntax-highlighter（コード表示）
- react-markdown + remark-gfm（解説表示）
- agent-server（Railway）経由で Claude API 呼び出し

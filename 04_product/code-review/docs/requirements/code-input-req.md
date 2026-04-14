# コード入力UI 要件定義書

優先度：High

## 概要

ユーザーがコードを入力する方法を3種類提供する。

## 要件

### Tab A: コード直接貼り付け

- `<textarea>` で直接コードを貼り付ける
- フォント: `JetBrains Mono`（等幅）
- 最大5000行（それ以上は警告を表示）
- 行番号表示（CSSカウンターで実装、またはスタイルで代替）
- プレースホルダー: 「ここにコードを貼り付けてください...」

### Tab B: GitHub URL 入力

- `github.com/owner/repo/blob/branch/path/to/file.ts` 形式
- `raw.githubusercontent.com/...` 形式も対応
- 入力後「読み込む」ボタンをクリック → コードを自動取得してTab Aのtextareaに表示
- エラー時はメッセージを表示（「リポジトリが見つかりません」「アクセス権限がありません」等）
- プライベートリポジトリ: サーバーサイドの `GITHUB_TOKEN` で自動認証

### Tab C: 自社リポジトリパス入力

- `04_product/code-review/src/app/page.tsx` 形式（ルートからの相対パス）
- agent-server の `read_file` ツールを経由して取得
- 入力後「読み込む」ボタンをクリック → コードを取得してtextareaに表示

## 共通要件

- 言語選択セレクト（JavaScript / TypeScript / Python / Go / Rust / Java / C++ / PHP / Ruby / その他）
- 解説レベル選択（ラジオボタン）: 小学生 / 中高生 / エンジニア
- モード選択: 「解説する」「レビューする」ボタン（並列配置）
- コードが空の場合は送信ボタンをdisabledにする

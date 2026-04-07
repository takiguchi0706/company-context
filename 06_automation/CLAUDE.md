# 自動化部 CLAUDE.md

## 役割
AIエージェント構築・ログ自動化・MCP連携・Webhook設定

## 担当エージェント
ゼン

## 主な業務
- ログ→Notion自動まとめエージェント（設計済み・未実装）
- Webhook連携設定（送信先は後で決定）
- Claude Code自動化プロンプトの整備
- 定期実行スクリプトの管理

## 設計済みエージェント：log-to-Notion
- トリガー：「ログまとめて」
- フロー：Claude Code + Anthropic API + Notion MCP
- 出力：note風記事をNotionに書き込み・ログをアーカイブ

## Windows環境注意
- PowerShell heredoc：@' ... '@ + Set-Content
- npm前にSet-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
- Claude Code PATH：C:\Users\valuc\.local\bin

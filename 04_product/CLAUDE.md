# プロダクト部 CLAUDE.md

## 役割
プロダクト開発・機能実装の統括（品質保証は11_qaが担当）

## 担当エージェント
リク

## 運用ルール
- 各プロダクトは配下のフォルダに自己完結している
- 新プロダクト追加時はフォルダを作りCLAUDE.mdを置くだけ
- このファイルにプロダクト一覧は書かない

## 技術スタック共通
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase（認証・DB）
- Claude API (claude-sonnet-4-20250514)
- Vercel（デプロイ）

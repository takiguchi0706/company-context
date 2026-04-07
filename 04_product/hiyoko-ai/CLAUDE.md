# ひよこAI CLAUDE.md

## プロダクト概要
育児記録・AI相談アプリ（0歳〜3歳の子どもを持つ親向け）

## 技術スタック
- React Native + Expo SDK 55 + TypeScript
- Supabase（認証・DB・RLS）
- Claude API
- Expo Router + React Navigation（4タブBottomTabNavigator）

## 実装済み
- DBスキーマ（6テーブル・RLS設定済み）
- Auth/Home/Chat/Recordの各画面スキャフォルド

## 実装順序
Auth → Home → Chat → Record → App.tsx

## UX制約
- 48dp最小タッチターゲット（片手夜間操作）
- ダークモード対応（ヘッダートグル）
- AI disclaimer bannerを常時表示
- 38.0℃以上で小児救急電話（#8000）を表示

## 開発ステータス
開発一時停止中・ダッシュボード完成後に再開予定

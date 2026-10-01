# Codex リセット追跡のコア

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [繁體中文](README.zh-HK.md)

公開されたリセット告知を正規化し、出典を保ち、通常の利用枠リセットと保存されたリセット回数を区別し、過去の間隔頻度を記述する JavaScript モジュールです。アカウントへのアクセス、個人の使用量、実際の履歴データ一式は含みません。

## ローカル実行

Node.js 20 以降を使用し、依存パッケージは不要です。

```sh
git clone https://github.com/awesomellm/codex-reset-tracker.git
cd codex-reset-tracker
node --test reset.test.mjs
node example.mjs ja
```

例は七件の架空イベントと固定した基準時刻を使い、通信を行いません。残存する五区間のうち二区間が次の48時間以内に入るため、記述的な頻度は40%です。現在の告知、特定アカウントの予測、校正済み確率を示すものではありません。

## モジュール

- `normalizeSnapshot`：記録、時刻、出典を検証し、保守的な状態分類を行います。
- `validateSnapshot`：正規化済みのデータを検証します。元のデータの経過時間は更新しません。
- `forecastReset`：隣接する適格なイベントを選び、件数、割合、または出力停止の理由を返します。
- `fetchResetSnapshot`：任意の公開フィード取得です。カーソルのページ送り、最も古い生成時刻、制限されたリクエストを扱います。読み込みと例の実行では通信しません。

[方法と制約](METHOD.ja.md) に対象範囲、標本条件、条件付き頻度の式があります。[型宣言](codex-reset.d.mts) は共通APIを定義します。識別子、分類理由、技術的な出典記録は英語で、説明文と例のメッセージは四言語で独立しています。

元の実装の架空イベント分類、ページ送り、不確実性、重複、数値のテストを保持しました。実際の履歴に依存した二件は、架空の出典検証と公開イベント範囲のテストに置き換えています。

[日本語のオンライン版](https://zequnweb.com/jp/tools/codex-reset-tracker/)と [ZequnWeb](https://zequnweb.com/jp/) も参照できます。コードはMITライセンス（`LICENSE`）です。第三者のデータやサービスの条件はコードのライセンスとは別です。

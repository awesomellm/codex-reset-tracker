# Codex 重置追蹤器核心

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [繁體中文](README.zh-HK.md)

可重用的 JavaScript 模組，用於正規化公開重置公告、保留來源、區分普通額度重置及儲存重置次數，並描述歷史間隔頻率。倉庫不包含帳戶存取、私人用量資料或真實歷史資料整包。

## 本機運行

需要 Node.js 20 或更新版本，毋須依賴套件：

```sh
git clone https://github.com/awesomellm/codex-reset-tracker.git
cd codex-reset-tracker
node --test reset.test.mjs
node example.mjs zh-HK
```

範例使用七條虛構事件及固定參考時間，不發起網絡請求。五個仍符合條件的間隔中，兩條落入接下來 48 小時範圍，得到描述性的 40% 頻率。範例不是當前公告，不預測特定帳戶，亦不是經過校準的機率。

## 模組

- `normalizeSnapshot`：驗證資料記錄、時間及來源，採用保守狀態分類。
- `validateSnapshot`：驗證已正規化快照，不更新其原始資料年齡。
- `forecastReset`：篩選相鄰且符合條件的事件，傳回計數、百分比或暫停輸出的原因。
- `fetchResetSnapshot`：可選的公開資料讀取，處理游標分頁、最早生成時間及受限請求。匯入模組及運行範例均不會讀取網絡。

[方法與限制](METHOD.zh-HK.md) 說明範圍、樣本門檻及條件頻率公式。[型別宣告](codex-reset.d.mts) 描述共用介面。程式識別碼、分類原因及技術來源記錄採用英文；文件與範例說明提供四種獨立語言版本。

測試保留原實作的虛構事件分類、分頁、不確定性、重複記錄及數值檢查。兩項依賴網站真實歷史資料的測試，改為虛構來源驗證及公開事件範圍測試。

可查看[繁體中文線上追蹤器](https://zequnweb.com/zh-hk/tools/codex-reset-tracker/)及 [ZequnWeb](https://zequnweb.com/zh-hk/)。軟件採用 MIT 授權條款（`LICENSE`）；第三方資料及服務條款與程式授權分開處理。

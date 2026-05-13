# Google Sheets 同步設定步驟

這個版本會讓手機 PWA 直接透過 Google 登入存取你的 Google Sheet。前端只會放 OAuth Client ID，不會放服務帳號金鑰或私人密鑰。

## 1. 建立 Google Sheet

建立一份新的 Google Sheet，第一個工作表命名為：

```text
Expenses
```

第 1 列貼上欄位：

```text
id,date,amount,categoryId,categoryName,note,createdAt,updatedAt,deletedAt,syncStatus,syncedAt,deviceId,syncVersion
```

記下網址中的 spreadsheet ID，例如：

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## 2. 建立 Google Cloud 專案

1. 到 Google Cloud Console 建立新專案。
2. 啟用 Google Sheets API。
3. 到 OAuth consent screen 建立同意畫面。
4. User type 選 External 即可，測試階段把自己的 Google 帳號加入 Test users。

## 3. 建立 OAuth Client ID

1. 到 Credentials。
2. 建立 OAuth client ID。
3. Application type 選 Web application。
4. Authorized JavaScript origins 加上部署後的網站來源，例如：

```text
https://your-name.github.io
```

本機測試如果用 localhost，另外加：

```text
http://localhost:5181
```

5. 建立後記下 Client ID。

## 4. App 需要的設定

下一步會在 App 加入這兩個設定：

```js
const GOOGLE_CLIENT_ID = "你的 OAuth Client ID";
const GOOGLE_SHEET_ID = "你的 Spreadsheet ID";
```

## 5. 同步策略

App 會採用：

- 本機 IndexedDB 是主要資料庫。
- 新增、更新、刪除先寫入本機，標記為 `pending`。
- 使用者按同步後，App 將 `pending` 資料寫入 Google Sheet。
- Sheet 上同 ID 的資料會用較新的 `syncVersion` / `updatedAt` 覆蓋。
- 刪除不會直接移除列，而是寫入 `deletedAt`，避免多裝置同步時資料復活。

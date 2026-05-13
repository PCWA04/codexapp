# Google Sheet 欄位設計

請先建立一個 Google Sheet，第一個工作表命名為 `Expenses`，第 1 列放以下欄位名稱：

```text
id,date,amount,categoryId,categoryName,note,createdAt,updatedAt,deletedAt,syncStatus,syncedAt,deviceId,syncVersion
```

欄位用途：

- `id`：每筆記帳資料的唯一 ID。
- `date`：消費日期，格式為 `YYYY-MM-DD`。
- `amount`：金額。
- `categoryId`：App 內部使用的類別 ID。
- `categoryName`：方便在試算表中閱讀的類別名稱。
- `note`：備註。
- `createdAt`：建立時間。
- `updatedAt`：最後更新時間。
- `deletedAt`：刪除時間；空白代表沒有刪除。
- `syncStatus`：同步狀態，App 端會使用 `pending` / `synced`。
- `syncedAt`：最後同步成功時間。
- `deviceId`：產生資料的裝置 ID。
- `syncVersion`：資料版本，用來判斷哪一筆比較新。

下一步會建立 Google Apps Script，讓 App 可以把本機 IndexedDB 的資料同步到這張表。

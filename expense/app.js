const LEGACY_STORAGE_KEY = "mobile-ledger-expenses-v1";
const DB_NAME = "mobile-ledger-db";
const DB_VERSION = 1;
const STORE_NAME = "expenses";

const categories = [
  { id: "food", name: "餐飲", color: "#c65b3b" },
  { id: "transport", name: "交通", color: "#2f6f9f" },
  { id: "shopping", name: "購物", color: "#8c5aa8" },
  { id: "daily", name: "日用品", color: "#7a7d38" },
  { id: "entertainment", name: "娛樂", color: "#d08b22" },
  { id: "medical", name: "醫療", color: "#34856f" },
  { id: "other", name: "其他", color: "#6d6f75" },
];

const $ = (selector) => document.querySelector(selector);

const form = $("#expenseForm");
const expenseIdInput = $("#expenseId");
const dateInput = $("#dateInput");
const amountInput = $("#amountInput");
const categoryInput = $("#categoryInput");
const noteInput = $("#noteInput");
const submitButton = $("#submitButton");
const formStatus = $("#formStatus");
const resetFormButton = $("#resetFormButton");
const recentList = $("#recentList");
const recordCount = $("#recordCount");
const todayTotal = $("#todayTotal");
const clearAllButton = $("#clearAllButton");
const periodInput = $("#periodInput");
const periodLabel = $("#periodLabel");
const periodTotal = $("#periodTotal");
const periodCount = $("#periodCount");
const categoryChart = $("#categoryChart");
const periodList = $("#periodList");

let expenses = [];
let activePeriod = "day";
let selectedDate = getToday();
let db = null;
let storageMode = "memory";

function getToday() {
  return formatLocalDate(new Date());
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `expense-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAllFromDb() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function writeAllToDb(items) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    items.forEach((item) => store.put(item));

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}

function loadFromLegacyStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeToLegacyStorage(items) {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function normalizeExpense(expense) {
  const now = new Date().toISOString();
  return {
    id: expense.id || createId(),
    date: expense.date || getToday(),
    amount: Number(expense.amount) || 0,
    categoryId: expense.categoryId || "other",
    note: expense.note || "",
    createdAt: expense.createdAt || now,
    updatedAt: expense.updatedAt || now,
    deletedAt: expense.deletedAt || "",
    syncStatus: expense.syncStatus || "pending",
    syncedAt: expense.syncedAt || "",
    deviceId: expense.deviceId || getDeviceId(),
    syncVersion: Number(expense.syncVersion) || 1,
  };
}

function getDeviceId() {
  const key = "mobile-ledger-device-id";
  try {
    let value = localStorage.getItem(key);
    if (!value) {
      value = createId();
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "device-local";
  }
}

async function loadExpenses() {
  const legacyItems = loadFromLegacyStorage().map(normalizeExpense);

  try {
    db = await openDatabase();
    storageMode = "indexeddb";
    const dbItems = (await readAllFromDb()).map(normalizeExpense);

    if (!dbItems.length && legacyItems.length) {
      await writeAllToDb(legacyItems);
      return legacyItems;
    }

    return dbItems;
  } catch {
    storageMode = writeToLegacyStorage(legacyItems) ? "localstorage" : "memory";
    return legacyItems;
  }
}

async function saveExpenses() {
  try {
    if (storageMode === "indexeddb" && db) {
      await writeAllToDb(expenses);
      return true;
    }

    if (storageMode === "localstorage") {
      return writeToLegacyStorage(expenses);
    }

    return false;
  } catch {
    storageMode = writeToLegacyStorage(expenses) ? "localstorage" : "memory";
    return storageMode !== "memory";
  }
}

function getVisibleExpenses() {
  return expenses.filter((expense) => !expense.deletedAt);
}

function setFormStatus(message, isWarning = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("warning", isWarning);
}

function getCategory(categoryId) {
  return categories.find((category) => category.id === categoryId) || categories[categories.length - 1];
}

function sortExpenses(items) {
  return [...items].sort((a, b) => {
    if (a.date === b.date) return b.createdAt.localeCompare(a.createdAt);
    return b.date.localeCompare(a.date);
  });
}

function setDefaultDates() {
  const today = getToday();
  dateInput.value = today;
  selectedDate = today;
  periodInput.value = today;
}

function populateCategories() {
  categoryInput.innerHTML = categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join("");
}

function resetForm() {
  expenseIdInput.value = "";
  amountInput.value = "";
  noteInput.value = "";
  categoryInput.value = "food";
  dateInput.value = getToday();
  submitButton.textContent = "儲存";
  setFormStatus("");
}

function renderExpenseList(container, items, limit) {
  const visibleItems = typeof limit === "number" ? sortExpenses(items).slice(0, limit) : sortExpenses(items);

  if (!visibleItems.length) {
    container.innerHTML = `<p class="empty-state">目前沒有紀錄。</p>`;
    return;
  }

  container.innerHTML = visibleItems
    .map((expense) => {
      const category = getCategory(expense.categoryId);
      const note = expense.note ? `<div class="expense-note">${escapeHtml(expense.note)}</div>` : "";
      return `
        <article class="expense-item">
          <div class="expense-main">
            <div class="expense-category">
              <span class="category-dot" style="background:${category.color}"></span>
              <span>${category.name}</span>
            </div>
            <div class="expense-meta">${expense.date}</div>
            ${note}
          </div>
          <div class="expense-side">
            <div class="expense-amount">${formatCurrency(expense.amount)}</div>
            <div class="actions">
              <button class="mini-button" type="button" data-action="edit" data-id="${expense.id}" aria-label="編輯">編</button>
              <button class="mini-button delete" type="button" data-action="delete" data-id="${expense.id}" aria-label="刪除">刪</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function getPeriodKey(date, period) {
  if (period === "year") return date.slice(0, 4);
  if (period === "month") return date.slice(0, 7);
  return date;
}

function getCurrentPeriodKey() {
  return getPeriodKey(selectedDate, activePeriod);
}

function getPeriodItems() {
  const targetKey = getCurrentPeriodKey();
  return getVisibleExpenses().filter((expense) => getPeriodKey(expense.date, activePeriod) === targetKey);
}

function updatePeriodInput() {
  if (activePeriod === "year") {
    periodInput.type = "number";
    periodInput.min = "2000";
    periodInput.max = "2100";
    periodInput.step = "1";
    periodInput.value = selectedDate.slice(0, 4);
    periodLabel.textContent = "選擇年份";
    return;
  }

  periodInput.type = activePeriod === "month" ? "month" : "date";
  periodInput.removeAttribute("min");
  periodInput.removeAttribute("max");
  periodInput.removeAttribute("step");
  periodInput.value = activePeriod === "month" ? selectedDate.slice(0, 7) : selectedDate;
  periodLabel.textContent = activePeriod === "month" ? "選擇月份" : "選擇日期";
}

function renderStats() {
  const items = getPeriodItems();
  const total = items.reduce((sum, expense) => sum + expense.amount, 0);
  const grouped = categories
    .map((category) => {
      const amount = items
        .filter((expense) => expense.categoryId === category.id)
        .reduce((sum, expense) => sum + expense.amount, 0);
      return { ...category, amount };
    })
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  periodTotal.textContent = formatCurrency(total);
  periodCount.textContent = String(items.length);

  if (!grouped.length) {
    categoryChart.innerHTML = `<p class="empty-state">這個期間還沒有消費資料。</p>`;
  } else {
    categoryChart.innerHTML = grouped
      .map((category) => {
        const percent = Math.round((category.amount / total) * 100);
        return `
          <div class="chart-row">
            <div class="chart-top">
              <span class="chart-label">
                <span class="category-dot" style="background:${category.color}"></span>
                <span>${category.name}</span>
              </span>
              <span>${formatCurrency(category.amount)} · ${percent}%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${percent}%; background:${category.color}"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  renderExpenseList(periodList, items);
}

function render() {
  const visibleExpenses = getVisibleExpenses();
  const today = getToday();
  const todaySum = visibleExpenses
    .filter((expense) => expense.date === today)
    .reduce((sum, expense) => sum + expense.amount, 0);

  todayTotal.textContent = `今日 ${formatCurrency(todaySum)}`;
  recordCount.textContent = `${visibleExpenses.length} 筆`;
  renderExpenseList(recentList, visibleExpenses, 6);
  renderStats();
}

async function handleSubmit(event) {
  event.preventDefault();

  const amount = Number(amountInput.value);
  if (!dateInput.value || !amount || amount <= 0 || !categoryInput.value) {
    setFormStatus("請確認日期、金額和類別都有正確填寫。", true);
    return;
  }

  const now = new Date().toISOString();
  const id = expenseIdInput.value;
  const existingExpense = id ? expenses.find((expense) => expense.id === id) : null;
  const payload = normalizeExpense({
    id: id || createId(),
    date: dateInput.value,
    amount,
    categoryId: categoryInput.value,
    note: noteInput.value.trim(),
    createdAt: existingExpense?.createdAt || now,
    updatedAt: now,
    syncStatus: "pending",
    syncVersion: (existingExpense?.syncVersion || 0) + 1,
  });

  if (id) {
    expenses = expenses.map((expense) => (expense.id === id ? payload : expense));
  } else {
    expenses = [payload, ...expenses];
  }

  const savedToBrowser = await saveExpenses();
  resetForm();
  render();
  if (savedToBrowser) {
    setFormStatus(id ? "已更新，等待同步。" : "已儲存，等待同步。");
  } else {
    setFormStatus("已加入畫面，但目前瀏覽器不允許永久儲存。", true);
  }
}

async function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const expense = expenses.find((item) => item.id === button.dataset.id && !item.deletedAt);
  if (!expense) return;

  if (button.dataset.action === "delete") {
    const now = new Date().toISOString();
    expenses = expenses.map((item) =>
      item.id === expense.id
        ? { ...item, deletedAt: now, updatedAt: now, syncStatus: "pending", syncVersion: item.syncVersion + 1 }
        : item
    );
    const savedToBrowser = await saveExpenses();
    render();
    if (!savedToBrowser) setFormStatus("已從畫面移除，但目前瀏覽器不允許永久儲存。", true);
    return;
  }

  expenseIdInput.value = expense.id;
  dateInput.value = expense.date;
  amountInput.value = expense.amount;
  categoryInput.value = expense.categoryId;
  noteInput.value = expense.note || "";
  submitButton.textContent = "更新";
  switchView("entryView");
  amountInput.focus();
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
}

function bindEvents() {
  window.addEventListener("error", () => {
    setFormStatus("操作失敗，請重新整理後再試一次。", true);
  });

  form.addEventListener("submit", handleSubmit);
  form.addEventListener(
    "invalid",
    () => {
      setFormStatus("請確認日期、金額和類別都有正確填寫。", true);
    },
    true
  );
  resetFormButton.addEventListener("click", resetForm);
  recentList.addEventListener("click", handleListClick);
  periodList.addEventListener("click", handleListClick);
  periodInput.addEventListener("change", () => {
    const value = periodInput.value || getToday();
    if (activePeriod === "year") {
      selectedDate = `${value}-01-01`;
    } else if (activePeriod === "month") {
      selectedDate = `${value}-01`;
    } else {
      selectedDate = value;
    }
    renderStats();
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      activePeriod = button.dataset.period;
      document.querySelectorAll(".segment").forEach((segment) => {
        segment.classList.toggle("active", segment === button);
      });
      updatePeriodInput();
      renderStats();
    });
  });

  clearAllButton.addEventListener("click", async () => {
    if (!getVisibleExpenses().length) return;
    const confirmed = confirm("確定要清除全部記帳資料嗎？");
    if (!confirmed) return;

    const now = new Date().toISOString();
    expenses = expenses.map((expense) => ({
      ...expense,
      deletedAt: expense.deletedAt || now,
      updatedAt: now,
      syncStatus: "pending",
      syncVersion: expense.syncVersion + 1,
    }));
    await saveExpenses();
    resetForm();
    render();
  });
}

async function init() {
  populateCategories();
  setDefaultDates();
  bindEvents();
  expenses = await loadExpenses();
  render();
}

init();

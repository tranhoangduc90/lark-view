const DEFAULT_API_BASE = "https://ducizone.ddns.net/lark-view";

function apiBase() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.")) {
    return "";
  }
  return window.LARK_VIEW_API_BASE || DEFAULT_API_BASE;
}

const els = {
  baseId: document.querySelector("#baseId"),
  tableId: document.querySelector("#tableId"),
  viewId: document.querySelector("#viewId"),
  loadButton: document.querySelector("#loadButton"),
  pageTitle: document.querySelector("#pageTitle"),
  pageCount: document.querySelector("#pageCount"),
  statusPill: document.querySelector("#statusPill"),
  message: document.querySelector("#message"),
  tableMount: document.querySelector("#tableMount"),
};

const params = new URLSearchParams(window.location.search);
els.baseId.value = params.get("base_id") || params.get("app_token") || "";
els.tableId.value = params.get("table_id") || "";
els.viewId.value = params.get("view_id") || "";

document.body.classList.toggle("has-source-params", Boolean(els.baseId.value && els.tableId.value && els.viewId.value));

function setStatus(text) {
  els.statusPill.textContent = text;
}

function showMessage(text) {
  els.message.hidden = !text;
  els.message.textContent = text || "";
}

function fieldMap(fields) {
  return new Map(fields.map((field) => [field.name, field]));
}

function rawValue(record, fieldName) {
  return record?.fields?.[fieldName];
}

function unwrapValue(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return value.value;
  }
  return value;
}

function isDateField(field) {
  return ["DateTime", "CreatedTime", "ModifiedTime"].includes(field?.uiType);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDate(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value || "");
  const date = new Date(numberValue);
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function textFromRichArray(value) {
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item?.text) return item.text;
      if (item?.name) return item.name;
      if (item?.link) return item.text || item.link;
      return "";
    })
    .filter(Boolean)
    .join("");
}

function plainText(value, field) {
  value = unwrapValue(value);
  if (value === null || value === undefined || value === "") return "";
  if (isDateField(field)) return formatDate(value);
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) return value.join(", ");
    return textFromRichArray(value);
  }
  if (value.link) return value.text || value.link;
  if (value.name) return value.name;
  if (value.text) return value.text;
  if (Array.isArray(value.text_arr)) return value.text_arr.join(", ");
  if (Array.isArray(value.link_record_ids)) return value.link_record_ids.join(", ");
  return JSON.stringify(value);
}

function createLink(href, text) {
  const link = document.createElement("a");
  link.className = "url-cell";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text || href;
  return link;
}

function firstUrl(value) {
  value = unwrapValue(value);
  if (!value) return "";
  if (typeof value === "string") return /^https?:\/\//i.test(value) ? value : "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstUrl(item);
      if (url) return url;
    }
    return "";
  }
  if (typeof value === "object") {
    return value.link || value.url || value.tmp_url || "";
  }
  return "";
}

function createCheckbox(value) {
  const box = document.createElement("span");
  box.className = `checkbox-box${value ? " is-checked" : ""}`;
  box.textContent = value ? "✓" : "";
  return box;
}

function appendRichArray(cell, value) {
  const linkedItem = value.find((item) => item?.link || item?.url);
  if (linkedItem) {
    cell.appendChild(createLink(linkedItem.link || linkedItem.url, linkedItem.text || linkedItem.name));
    return;
  }
  cell.textContent = textFromRichArray(value) || "-";
}

function appendValue(cell, value, field, record) {
  value = unwrapValue(value);
  if (value === null || value === undefined || value === "") {
    const empty = document.createElement("span");
    empty.className = "empty-cell";
    empty.textContent = "";
    cell.appendChild(empty);
    return;
  }

  if (field?.uiType === "Checkbox" || typeof value === "boolean") {
    cell.appendChild(createCheckbox(Boolean(value)));
    return;
  }

  if (isDateField(field)) {
    cell.textContent = formatDate(value);
    return;
  }

  if (Array.isArray(value)) {
    const attachments = value.filter((item) => item?.url || item?.tmp_url);
    if (attachments.length > 0) {
      attachments.forEach((item, index) => {
        if (index > 0) cell.appendChild(document.createElement("br"));
        cell.appendChild(createLink(item.tmp_url || item.url, item.name || `File ${index + 1}`));
      });
      return;
    }
    if (field?.name === "Bài tập") {
      const text = textFromRichArray(value) || "-";
      const href = firstUrl(rawValue(record, "Link BT")) || firstUrl(value);
      cell.appendChild(href ? createLink(href, text) : document.createTextNode(text));
      return;
    }
    appendRichArray(cell, value);
    return;
  }

  if (typeof value === "object") {
    if (value.link) {
      cell.appendChild(createLink(value.link, value.text || value.link));
      return;
    }
    cell.textContent = plainText(value, field) || "";
    return;
  }

  cell.textContent = String(value);
}

function optionIndex(value, field) {
  value = unwrapValue(value);
  const options = field?.property?.options;
  if (!Array.isArray(options)) return null;
  const text = plainText(value, field);
  const index = options.findIndex((option) => option.name === text);
  return index === -1 ? null : index;
}

function normalizeSortValue(value, field) {
  value = unwrapValue(value);
  if (value === null || value === undefined || value === "") return "";
  const selectIndex = optionIndex(value, field);
  if (selectIndex !== null) return selectIndex;
  if (isDateField(field) || typeof value === "number") return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return plainText(value, field).toLocaleLowerCase("vi-VN");
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "vi-VN", { numeric: true, sensitivity: "base" });
}

function sortRecords(records, sortConfig, fieldsByName) {
  if (!Array.isArray(sortConfig) || sortConfig.length === 0) return records;
  const sorted = [...records];
  sorted.sort((left, right) => {
    for (const item of sortConfig) {
      const fieldName = item.field || item.fieldName;
      if (!fieldName) continue;
      const field = fieldsByName.get(fieldName);
      const leftValue = normalizeSortValue(rawValue(left, fieldName), field);
      const rightValue = normalizeSortValue(rawValue(right, fieldName), field);
      const result = compareValues(leftValue, rightValue);
      if (result !== 0) return item.desc ? -result : result;
    }
    return 0;
  });
  return sorted;
}

function groupRecords(records, layout, fieldsByName) {
  const groupBy = layout.groupBy;
  if (!groupBy) return [{ key: "", rawValue: "", records }];

  const field = fieldsByName.get(groupBy);
  const groups = new Map();
  records.forEach((record) => {
    const value = rawValue(record, groupBy);
    const key = plainText(value, field) || "Chưa có giá trị";
    if (!groups.has(key)) groups.set(key, { key, rawValue: value, records: [] });
    groups.get(key).records.push(record);
  });

  const result = [...groups.values()];
  result.sort((left, right) => {
    const leftValue = normalizeSortValue(left.rawValue, field);
    const rightValue = normalizeSortValue(right.rawValue, field);
    const comparison = compareValues(leftValue, rightValue);
    return layout.groupDesc ? -comparison : comparison;
  });
  return result;
}

function displayFields(fields, layout) {
  const names = Array.isArray(layout.displayFieldNames) ? layout.displayFieldNames : [];
  if (names.length > 0) {
    const byName = fieldMap(fields);
    return names.map((name) => byName.get(name)).filter(Boolean);
  }
  return fields.filter((field) => !field.isHidden);
}

function fieldClass(field, index) {
  const classes = [];
  if (index === 0) classes.push("freeze-border");
  if (field.name === "Bài tập") classes.push("field-task");
  if (field.name === "Số lần đề xuất") classes.push("field-count");
  if (field.name === "Chờ luyện") classes.push("field-waiting");
  if (field.name === "Số lần luyện") classes.push("field-practice");
  if (field.name === "Timestamp") classes.push("field-time");
  return classes.join(" ");
}

function headerIcon(field) {
  return "";
}

function renderHeaderCell(th, field) {
  const wrap = document.createElement("span");
  wrap.className = "header-cell";
  const icon = headerIcon(field);
  if (icon) {
    const iconSpan = document.createElement("span");
    iconSpan.className = "header-icon";
    iconSpan.textContent = icon;
    wrap.appendChild(iconSpan);
  }
  const text = document.createElement("span");
  text.className = "header-text";
  text.textContent = field.name;
  wrap.appendChild(text);
  th.appendChild(wrap);
}

function groupLabel(group, layout, fieldsByName) {
  const labels = layout.groupLabels || {};
  const raw = unwrapValue(group.rawValue);
  if (typeof raw === "boolean") {
    const fallback = layout.groupBy === "Chờ luyện" ? (raw ? "Bài cần luyện tập" : "Bài đã luyện") : raw ? "Có" : "Không";
    return labels[String(raw)] || fallback;
  }
  const groupField = fieldsByName.get(layout.groupBy);
  return labels[group.key] || labels[String(raw)] || plainText(group.rawValue, groupField) || group.key;
}

function groupSectionClass(group, layout) {
  const raw = unwrapValue(group.rawValue);
  if (layout.groupBy === "Chờ luyện" && typeof raw === "boolean") {
    return raw ? "is-practice-needed" : "is-practice-done";
  }
  return "";
}

function renderGroupRow(tbody, group, fields, layout, fieldsByName, sectionClass) {
  const row = document.createElement("tr");
  row.className = `group-row ${sectionClass}`.trim();

  const indexCell = document.createElement("td");
  indexCell.className = "index-col";
  indexCell.textContent = "";
  row.appendChild(indexCell);

  fields.forEach((field, index) => {
    const cell = document.createElement("td");
    cell.className = fieldClass(field, index);
    if (index === 0) {
      const content = document.createElement("div");
      content.className = "group-cell";
      const label = document.createElement("span");
      label.className = "group-label";
      label.textContent = groupLabel(group, layout, fieldsByName);
      content.appendChild(label);
      const count = document.createElement("span");
      count.className = "group-count";
      count.textContent = `${group.records.length} bài tập`;
      content.appendChild(count);
      cell.appendChild(content);
    }
    row.appendChild(cell);
  });
  tbody.appendChild(row);
}

function renderGrid(groups, fields, fieldsByName, layout) {
  const scroll = document.createElement("div");
  scroll.className = "table-scroll";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const indexHead = document.createElement("th");
  indexHead.className = "index-col";
  indexHead.textContent = "";
  headerRow.appendChild(indexHead);

  fields.forEach((field, index) => {
    const th = document.createElement("th");
    th.className = fieldClass(field, index);
    renderHeaderCell(th, field);
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  groups.forEach((group) => {
    const sectionClass = groupSectionClass(group, layout);
    if (layout.groupBy) renderGroupRow(tbody, group, fields, layout, fieldsByName, sectionClass);
    group.records.forEach((record, recordIndex) => {
      const row = document.createElement("tr");
      row.className = `record-row ${sectionClass}`.trim();
      const indexCell = document.createElement("td");
      indexCell.className = "index-col";
      indexCell.textContent = String(recordIndex + 1);
      row.appendChild(indexCell);

      fields.forEach((field, index) => {
        const cell = document.createElement("td");
        cell.className = fieldClass(field, index);
        appendValue(cell, rawValue(record, field.name), field, record);
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
  });

  table.appendChild(tbody);
  scroll.appendChild(table);
  return scroll;
}

function updatePageHeader(payload, layout) {
  const returned = payload.meta?.returned ?? payload.records?.length ?? 0;
  const total = payload.meta?.total || returned;
  els.pageTitle.textContent = layout.title || payload.view?.name || "Lark Base View";
  els.pageCount.textContent = `${returned}/${total} bài tập`;
  if (payload.meta?.truncated) els.pageCount.textContent += " - giới hạn";
  if (payload.view?.warning) els.pageCount.textContent += " - thiếu metadata view";
}

function render(payload) {
  const fields = payload.fields || [];
  const records = payload.records || [];
  const layout = payload.layout || {};
  const fieldsByName = fieldMap(fields);
  const shownFields = displayFields(fields, layout);
  const sortedRecords = sortRecords(records, layout.sort, fieldsByName);
  const groups = groupRecords(sortedRecords, layout, fieldsByName);

  updatePageHeader(payload, layout);

  els.tableMount.replaceChildren();
  if (records.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "View này không có bài tập nào hoặc credential chưa có quyền đọc dữ liệu.";
    els.tableMount.appendChild(empty);
    return;
  }

  els.tableMount.appendChild(renderGrid(groups, shownFields, fieldsByName, layout));
}

async function loadView() {
  const baseId = els.baseId.value.trim();
  const tableId = els.tableId.value.trim();
  const viewId = els.viewId.value.trim();
  if (!baseId || !tableId || !viewId) {
    showMessage("Cần đủ Base ID, Table ID và View ID.");
    return;
  }

  showMessage("");
  setStatus("Đang tải");
  els.loadButton.disabled = true;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("base_id", baseId);
  nextUrl.searchParams.set("table_id", tableId);
  nextUrl.searchParams.set("view_id", viewId);
  window.history.replaceState(null, "", nextUrl);
  document.body.classList.add("has-source-params");

  try {
    const response = await fetch(
      `${apiBase()}/api/view?base_id=${encodeURIComponent(baseId)}&table_id=${encodeURIComponent(tableId)}&view_id=${encodeURIComponent(viewId)}`    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Không tải được view.");
    }
    render(payload);
    setStatus("Đã tải");
  } catch (error) {
    showMessage(error.message);
    setStatus("Lỗi");
  } finally {
    els.loadButton.disabled = false;
  }
}

els.loadButton.addEventListener("click", loadView);

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target?.tagName === "INPUT") loadView();
});

if (els.baseId.value && els.tableId.value && els.viewId.value) {
  loadView();
}

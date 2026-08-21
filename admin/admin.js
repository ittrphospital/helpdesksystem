if (sessionStorage.getItem("helpdesksystem.admin") !== "true") {
  window.location.href = "login.html";
}

const state = {
  tickets: [],
  filtered: []
};

const optionAll = "<option value=\"\">ทั้งหมด</option>";
const fields = {
  search: document.getElementById("searchText"),
  department: document.getElementById("departmentFilter"),
  category: document.getElementById("categoryFilter"),
  status: document.getElementById("statusFilter"),
  priority: document.getElementById("priorityFilter"),
  assignee: document.getElementById("assigneeFilter")
};
const importExcelInput = document.getElementById("importExcelInput");
const importResultBox = document.getElementById("importResultBox");
const nextTicketNoInput = document.getElementById("nextTicketNoInput");
const saveNextTicketNoButton = document.getElementById("saveNextTicketNoButton");
const clearTicketsButton = document.getElementById("clearTicketsButton");
const tableWidthKey = "helpdesksystem.admin.columnWidths.v2";
const defaultColumnWidths = [130, 120, 120, 170, 130, 154, 180, 170, 190, 180, 200];

function fillSelect(select, values) {
  select.innerHTML = optionAll + values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function getClosedDateTime(ticket) {
  if (ticket.status === "เสร็จสิ้น") return ticket.completedAt || "";
  if (ticket.status === "ยกเลิก") return ticket.cancelledAt || "";
  return "";
}

function renderBars(container, counts) {
  const max = Math.max(1, ...Object.values(counts));
  container.innerHTML = Object.entries(counts).map(([label, value]) => {
    const width = Math.max(8, Math.round((value / max) * 100));
    return `<div class="bar-row"><strong>${label}</strong><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><span>${value}</span></div>`;
  }).join("");
}

function buildOptions(values, currentValue) {
  const options = values.includes(currentValue) || !currentValue
    ? values
    : [currentValue, ...values];
  return options.map((value) => {
    const selected = currentValue === value ? "selected" : "";
    return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(value)}</option>`;
  }).join("");
}

function normalizeCell(value) {
  if (value instanceof Date) return value;
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text === "-" ? "" : text;
}

function showImportMessage(message, type = "success") {
  importResultBox.hidden = false;
  importResultBox.classList.toggle("error", type === "error");
  importResultBox.textContent = message;
}

function normalizeTicketNo(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidTicketNo(value) {
  return /^REQ-\d{6}$/.test(value);
}

function refreshNextTicketNo() {
  if (nextTicketNoInput) {
    nextTicketNoInput.value = window.HelpdeskStore.getNextTicketNo();
  }
}

function saveNextTicketNo() {
  const nextTicketNo = normalizeTicketNo(nextTicketNoInput.value);
  if (!isValidTicketNo(nextTicketNo)) {
    showImportMessage("กรุณากรอกเลข Ticket ในรูปแบบ REQ-690001", "error");
    nextTicketNoInput.focus();
    return;
  }

  window.HelpdeskStore.setNextTicketNo(nextTicketNo);
  refreshNextTicketNo();
  showImportMessage(`ตั้งเลข Ticket ถัดไปเป็น ${nextTicketNo} แล้ว`);
}

function clearTickets() {
  const nextTicketNo = normalizeTicketNo(nextTicketNoInput.value || window.HelpdeskStore.getNextTicketNo());
  if (!isValidTicketNo(nextTicketNo)) {
    showImportMessage("กรุณากรอกเลข Ticket ถัดไปในรูปแบบ REQ-690001 ก่อนล้างข้อมูล", "error");
    nextTicketNoInput.focus();
    return;
  }

  const confirmed = window.confirm(`ต้องการล้างรายการแจ้งซ่อมทั้งหมดใน browser นี้หรือไม่?\n\nหลังล้างข้อมูล เลข Ticket ถัดไปจะเริ่มที่ ${nextTicketNo}`);
  if (!confirmed) return;

  window.HelpdeskStore.clearTickets(nextTicketNo);
  clearFilters();
  refreshNextTicketNo();
  load();
  showImportMessage(`ล้างข้อมูลทั้งหมดแล้ว เลข Ticket ถัดไปคือ ${nextTicketNo}`);
}

function normalizeImportedYear(year) {
  if (year > 3000) return year - 1086;
  if (year > 2400) return year - 543;
  return year;
}

function buildBangkokIso(year, month, day, hour, minute) {
  return `${String(normalizeImportedYear(Number(year))).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`;
}

function parseThaiDateTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return buildBangkokIso(value.getFullYear(), value.getMonth() + 1, value.getDate(), value.getHours(), value.getMinutes());
  }

  const text = normalizeCell(value);
  if (!text) return "";
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    return buildBangkokIso(direct.getFullYear(), direct.getMonth() + 1, direct.getDate(), direct.getHours(), direct.getMinutes());
  }

  const numericMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (numericMatch) {
    return buildBangkokIso(numericMatch[3], numericMatch[2], numericMatch[1], numericMatch[4], numericMatch[5]);
  }

  const months = {
    "ม.ค.": 1, "มกราคม": 1,
    "ก.พ.": 2, "กุมภาพันธ์": 2,
    "มี.ค.": 3, "มีนาคม": 3,
    "เม.ย.": 4, "เมษายน": 4,
    "พ.ค.": 5, "พฤษภาคม": 5,
    "มิ.ย.": 6, "มิถุนายน": 6,
    "ก.ค.": 7, "กรกฎาคม": 7,
    "ส.ค.": 8, "สิงหาคม": 8,
    "ก.ย.": 9, "กันยายน": 9,
    "ต.ค.": 10, "ตุลาคม": 10,
    "พ.ย.": 11, "พฤศจิกายน": 11,
    "ธ.ค.": 12, "ธันวาคม": 12
  };
  const match = text.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!match || !months[match[2]]) return "";
  return buildBangkokIso(match[3], months[match[2]], match[1], match[4], match[5]);
}

function getCell(row, indexMap, header) {
  const index = indexMap.get(header);
  if (index === undefined) return "";
  const value = normalizeCell(row[index]);
  return value instanceof Date ? value : value;
}

function rowsFromHtmlTable(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const table = tables.find((candidate) => {
    const firstRow = candidate.querySelector("tr");
    if (!firstRow) return false;
    const headers = Array.from(firstRow.children).map((cell) => normalizeCell(cell.textContent));
    return ["เลขที่", "ผู้แจ้ง", "แผนก", "ประเภท", "สถานะ"].every((header) => headers.includes(header));
  });
  if (!table) {
    if (html.includes("_files/sheet001.htm") || html.includes("frSheet")) {
      throw new Error("ไฟล์นี้เป็นไฟล์หลักของ Excel กรุณาเลือกไฟล์ sheet001.htm ในโฟลเดอร์ *_files หรือใช้ไฟล์ .xls ที่ export จากระบบโดยตรง");
    }
    throw new Error("ไม่พบตารางรายการแจ้งซ่อมในไฟล์ Excel");
  }
  return Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => normalizeCell(cell.textContent))
  ).filter((row) => row.some(Boolean));
}

function parseImportedRows(rows) {
  if (rows.length < 2) {
    throw new Error("ไม่พบรายการแจ้งซ่อมในไฟล์ Excel");
  }

  const defaultHeaders = ["เลขที่", "ผู้แจ้ง", "แผนก", "ประเภท", "ความเร่งด่วน", "สถานะ", "ผู้รับผิดชอบ", "วันที่แจ้ง", "วันที่ปิดงาน/ยกเลิก", "รายละเอียด", "การแก้ปัญหา"];
  const headerRow = rows[0].map((cell) => normalizeCell(cell));
  const indexMap = new Map(headerRow.map((header, index) => [header, index]));
  const requiredHeaders = ["เลขที่", "ผู้แจ้ง", "แผนก", "ประเภท", "สถานะ"];
  const missingHeaders = requiredHeaders.filter((header) => !indexMap.has(header));
  const canFallbackToTemplate = missingHeaders.length && rows[1] && /^REQ-\d{6}$/.test(String(rows[1][0] || "").trim()) && rows[0].length >= defaultHeaders.length;
  if (canFallbackToTemplate) {
    defaultHeaders.forEach((header, index) => indexMap.set(header, index));
  } else if (missingHeaders.length) {
    throw new Error(`ไฟล์ Excel ขาดคอลัมน์: ${missingHeaders.join(", ")}`);
  }

  return rows.slice(1).map((row, index) => {
    const ticketNo = getCell(row, indexMap, "เลขที่");
    if (!ticketNo) return null;

    const status = getCell(row, indexMap, "สถานะ") || "รอรับเรื่อง";
    const closedAt = parseThaiDateTime(getCell(row, indexMap, "วันที่ปิดงาน/ยกเลิก"));
    const createdAt = parseThaiDateTime(getCell(row, indexMap, "วันที่แจ้ง")) || new Date().toISOString();
    return {
      id: Date.now() + index,
      ticketNo,
      requesterName: String(getCell(row, indexMap, "ผู้แจ้ง") || "-"),
      department: String(getCell(row, indexMap, "แผนก") || "-"),
      category: String(getCell(row, indexMap, "ประเภท") || "-"),
      priority: String(getCell(row, indexMap, "ความเร่งด่วน") || "-"),
      status,
      assignee: String(getCell(row, indexMap, "ผู้รับผิดชอบ") || ""),
      title: String(getCell(row, indexMap, "ประเภท") || "-"),
      description: String(getCell(row, indexMap, "รายละเอียด") || "-"),
      solution: String(getCell(row, indexMap, "การแก้ปัญหา") || ""),
      attachmentName: "",
      source: "import",
      createdAt,
      updatedAt: closedAt || createdAt,
      completedAt: status === "เสร็จสิ้น" ? closedAt : "",
      cancelledAt: status === "ยกเลิก" ? closedAt : ""
    };
  }).filter(Boolean);
}

function parseImportedTickets(html) {
  return parseImportedRows(rowsFromHtmlTable(html));
}

function parseImportedWorkbook(buffer) {
  if (!window.XLSX) {
    throw new Error("ยังโหลดตัวอ่านไฟล์ .xlsx ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตหรือ refresh หน้าเว็บแล้วลองใหม่");
  }
  const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("ไม่พบ sheet ในไฟล์ Excel");
  }
  const rows = window.XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: ""
  }).filter((row) => row.some((cell) => normalizeCell(cell)));
  return parseImportedRows(rows);
}

function renderKpis(items) {
  const total = items.length;
  const open = items.filter((item) => item.status === "รอรับเรื่อง" || item.status === "กำลังดำเนินการ").length;
  const done = items.filter((item) => item.status === "เสร็จสิ้น").length;
  const cancel = items.filter((item) => item.status === "ยกเลิก").length;

  document.querySelector("[data-kpi-total]").textContent = total;
  document.querySelector("[data-kpi-open]").textContent = open;
  document.querySelector("[data-kpi-done]").textContent = done;
  document.querySelector("[data-kpi-cancel]").textContent = cancel;
  const dataModeText = document.getElementById("dataModeText");
  if (dataModeText) {
    const hasUserTickets = window.HelpdeskStore.getUserTickets().length > 0;
    const dataCleared = Boolean(window.HelpdeskStore.getSettings().dataCleared);
    dataModeText.textContent = hasUserTickets
      ? "แสดงเฉพาะใบงานที่ผู้ใช้ส่งจริงจาก browser นี้ เพื่อให้ข้อมูลตรงกับหน้า user"
      : dataCleared
        ? "ล้างข้อมูลแล้ว ยังไม่มีใบงานใหม่ใน browser นี้"
        : "ยังไม่มีใบงานที่ผู้ใช้ส่งจริง จึงแสดงข้อมูลตัวอย่าง 2 รายการสำหรับทดลองหน้า dashboard";
  }
}

function applyColumnWidths(table, widths) {
  const headers = Array.from(table.querySelectorAll("thead th"));
  const activeWidths = widths && widths.length === headers.length
    ? widths
    : headers.map((header, index) => defaultColumnWidths[index] || Math.ceil(header.getBoundingClientRect().width));
  let totalWidth = 0;

  headers.forEach((header, index) => {
    const width = Math.max(90, Number(activeWidths[index]) || 120);
    header.style.width = `${width}px`;
    totalWidth += width;
  });

  table.style.width = `${Math.max(totalWidth, table.parentElement.clientWidth)}px`;
  table.classList.add("resizable-table");
}

function setupResizableColumns() {
  const table = document.getElementById("ticketTable");
  if (!table || table.dataset.resizable === "true") return;

  table.dataset.resizable = "true";
  const headers = Array.from(table.querySelectorAll("thead th"));
  const savedWidths = JSON.parse(localStorage.getItem(tableWidthKey) || "null");
  applyColumnWidths(table, savedWidths);

  headers.forEach((header, index) => {
    const handle = document.createElement("span");
    handle.className = "column-resizer";
    handle.setAttribute("aria-hidden", "true");
    header.appendChild(handle);

    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = header.getBoundingClientRect().width;
      document.body.classList.add("resizing-column");

      const onMove = (moveEvent) => {
        const nextWidth = Math.max(90, Math.round(startWidth + moveEvent.clientX - startX));
        const widths = headers.map((item, widthIndex) => {
          if (widthIndex === index) return nextWidth;
          return Math.round(item.getBoundingClientRect().width);
        });
        applyColumnWidths(table, widths);
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.classList.remove("resizing-column");
        const widths = headers.map((item) => Math.round(item.getBoundingClientRect().width));
        localStorage.setItem(tableWidthKey, JSON.stringify(widths));
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  });
}

function renderTable(items) {
  document.getElementById("ticketRows").innerHTML = items.map((ticket) => {
    const currentStatusClass = statusClass(ticket.status);
    const statusOptions = buildOptions(window.HelpdeskData.statuses, ticket.status);
    const categoryOptions = buildOptions(window.HelpdeskData.categories, ticket.category);
    const assignee = ticket.assignee || "";
    const solution = ticket.solution || "";
    const closedDateTime = getClosedDateTime(ticket);
    return `
      <tr>
        <td><strong>${ticket.ticketNo}</strong></td>
        <td>${ticket.requesterName}</td>
        <td>${ticket.department}</td>
        <td><select class="category-select" data-ticket-no="${ticket.ticketNo}">${categoryOptions}</select></td>
        <td>${ticket.priority}</td>
        <td>
          <select class="status-select status-${currentStatusClass}" data-ticket-no="${ticket.ticketNo}">${statusOptions}</select>
        </td>
        <td><input class="assignee-input" data-ticket-no="${ticket.ticketNo}" value="${escapeHtml(assignee)}" placeholder="ระบุผู้รับผิดชอบ"></td>
        <td>${formatDateTime(ticket.createdAt)}</td>
        <td>${closedDateTime ? formatDateTime(closedDateTime) : "-"}</td>
        <td class="desc-cell">${ticket.description}</td>
        <td><input class="solution-input" data-ticket-no="${ticket.ticketNo}" value="${escapeHtml(solution)}" placeholder="พิมพ์การแก้ปัญหา"></td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => {
      window.HelpdeskStore.updateStatus(select.dataset.ticketNo, select.value);
      load();
    });
  });

  document.querySelectorAll(".category-select").forEach((select) => {
    select.addEventListener("change", () => {
      window.HelpdeskStore.updateCategory(select.dataset.ticketNo, select.value);
      load();
    });
  });

  document.querySelectorAll(".assignee-input").forEach((input) => {
    input.addEventListener("change", () => {
      window.HelpdeskStore.updateAssignee(input.dataset.ticketNo, input.value);
      load();
    });
  });

  document.querySelectorAll(".solution-input").forEach((input) => {
    input.addEventListener("change", () => {
      window.HelpdeskStore.updateSolution(input.dataset.ticketNo, input.value);
      load();
    });
  });
}

function excelCell(value) {
  return `<td>${escapeHtml(value || "-")}</td>`;
}

function exportTicketsToExcel() {
  const rows = state.filtered.map((ticket) => {
    const closedDateTime = getClosedDateTime(ticket);
    return `<tr>
      ${excelCell(ticket.ticketNo)}
      ${excelCell(ticket.requesterName)}
      ${excelCell(ticket.department)}
      ${excelCell(ticket.category)}
      ${excelCell(ticket.priority)}
      ${excelCell(ticket.status)}
      ${excelCell(ticket.assignee)}
      ${excelCell(formatDateTime(ticket.createdAt))}
      ${excelCell(closedDateTime ? formatDateTime(closedDateTime) : "-")}
      ${excelCell(ticket.description)}
      ${excelCell(ticket.solution)}
    </tr>`;
  }).join("");
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<table>
  <thead>
    <tr>
      <th>เลขที่</th>
      <th>ผู้แจ้ง</th>
      <th>แผนก</th>
      <th>ประเภท</th>
      <th>ความเร่งด่วน</th>
      <th>สถานะ</th>
      <th>ผู้รับผิดชอบ</th>
      <th>วันที่แจ้ง</th>
      <th>วันที่ปิดงาน/ยกเลิก</th>
      <th>รายละเอียด</th>
      <th>การแก้ปัญหา</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateCode = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  link.href = url;
  link.download = `helpdesksystem-report-${dateCode}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importTicketsFromExcelFile(file) {
  const reader = new FileReader();
  const extension = file.name.split(".").pop().toLowerCase();
  const isWorkbookFile = ["xlsx", "xlsm", "xls"].includes(extension);

  reader.onload = () => {
    try {
      const tickets = isWorkbookFile
        ? parseImportedWorkbook(reader.result)
        : parseImportedTickets(String(reader.result || ""));
      if (!tickets.length) {
        throw new Error("ไม่พบรายการที่นำเข้าได้");
      }
      const result = window.HelpdeskStore.importTickets(tickets);
      showImportMessage(`นำเข้าไฟล์สำเร็จ ${result.total} รายการ เพิ่มใหม่ ${result.inserted} รายการ อัปเดต ${result.updated} รายการ`);
      clearFilters();
      load();
    } catch (error) {
      showImportMessage(error.message || "นำเข้าไฟล์ไม่สำเร็จ", "error");
    } finally {
      importExcelInput.value = "";
    }
  };
  reader.onerror = () => {
    showImportMessage("อ่านไฟล์ Excel ไม่สำเร็จ", "error");
    importExcelInput.value = "";
  };
  if (isWorkbookFile) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file, "utf-8");
  }
}

function applyFilters() {
  const search = fields.search.value.trim().toLowerCase();
  const assigneeSearch = fields.assignee.value.trim().toLowerCase();
  state.filtered = state.tickets.filter((ticket) => {
    const assignee = ticket.assignee || "";
    const solution = ticket.solution || "";
    const text = `${ticket.ticketNo} ${ticket.requesterName} ${ticket.department} ${ticket.category} ${ticket.description} ${assignee} ${solution}`.toLowerCase();
    return (!search || text.includes(search))
      && (!fields.department.value || ticket.department === fields.department.value)
      && (!fields.category.value || ticket.category === fields.category.value)
      && (!fields.status.value || ticket.status === fields.status.value)
      && (!fields.priority.value || ticket.priority === fields.priority.value)
      && (!assigneeSearch || assignee.toLowerCase().includes(assigneeSearch));
  });
  renderKpis(state.filtered);
  renderBars(document.getElementById("categoryChart"), countBy(state.filtered, "category"));
  renderBars(document.getElementById("statusChart"), countBy(state.filtered, "status"));
  renderTable(state.filtered);
  setFooterMetrics(state.filtered.length);
}

function load() {
  state.tickets = window.HelpdeskStore.getTickets();
  refreshNextTicketNo();
  applyFilters();
}

function clearFilters() {
  Object.values(fields).forEach((field) => {
    field.value = "";
  });
}

fillSelect(fields.department, window.HelpdeskData.departments);
fillSelect(fields.category, window.HelpdeskData.categories);
fillSelect(fields.status, window.HelpdeskData.statuses);
fillSelect(fields.priority, window.HelpdeskData.priorities);
Object.values(fields).forEach((field) => field.addEventListener("input", applyFilters));

document.getElementById("logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem("helpdesksystem.admin");
  window.location.href = "login.html";
});

document.getElementById("exportExcelButton").addEventListener("click", exportTicketsToExcel);
document.getElementById("importExcelButton").addEventListener("click", () => importExcelInput.click());
saveNextTicketNoButton.addEventListener("click", saveNextTicketNo);
clearTicketsButton.addEventListener("click", clearTickets);
nextTicketNoInput.addEventListener("input", () => {
  nextTicketNoInput.value = normalizeTicketNo(nextTicketNoInput.value);
});
importExcelInput.addEventListener("change", () => {
  const file = importExcelInput.files && importExcelInput.files[0];
  if (file) importTicketsFromExcelFile(file);
});

load();
setupResizableColumns();

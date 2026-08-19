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
const tableWidthKey = "helpdesksystem.admin.columnWidths";

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
  return values.map((value) => {
    const selected = currentValue === value ? "selected" : "";
    return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(value)}</option>`;
  }).join("");
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
    dataModeText.textContent = hasUserTickets
      ? "แสดงเฉพาะใบงานที่ผู้ใช้ส่งจริงจาก browser นี้ เพื่อให้ข้อมูลตรงกับหน้า user"
      : "ยังไม่มีใบงานที่ผู้ใช้ส่งจริง จึงแสดงข้อมูลตัวอย่าง 2 รายการสำหรับทดลองหน้า dashboard";
  }
}

function applyColumnWidths(table, widths) {
  const headers = Array.from(table.querySelectorAll("thead th"));
  const activeWidths = widths && widths.length === headers.length
    ? widths
    : headers.map((header) => Math.ceil(header.getBoundingClientRect().width));
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
  applyFilters();
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

load();
setupResizableColumns();

function fillOptions(select, values, label) {
  select.innerHTML = `<option value="">${label}</option>` + values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function findTicket(ticketNo) {
  return window.HelpdeskStore.getTickets().find((ticket) => ticket.ticketNo.toLowerCase() === ticketNo.trim().toLowerCase());
}

function renderTicket(ticket) {
  if (!ticket) {
    return `<div class="notice">ไม่พบเลข Ticket นี้ กรุณาตรวจสอบเลขอีกครั้ง</div>`;
  }
  return `
    <div class="ticket-result">
      <div><strong>${ticket.ticketNo}</strong> <span class="pill ${statusClass(ticket.status)}">${ticket.status}</span></div>
      <div>ผู้แจ้ง: ${ticket.requesterName} • แผนก: ${ticket.department}</div>
      <div>ประเภท: ${ticket.category} • ความเร่งด่วน: ${ticket.priority}</div>
      <div>แจ้งเมื่อ: ${formatDateTime(ticket.createdAt)}</div>
      <div>${ticket.description}</div>
      <div>ผู้ดำเนินการ: ${ticket.assignee || "-"}</div>
    </div>
  `;
}

function canUseApi() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function createTicketPayload(formData) {
  return {
    requesterName: formData.get("requesterName").trim(),
    department: formData.get("department"),
    category: formData.get("category"),
    priority: formData.get("priority") || "-",
    title: formData.get("category") || "-",
    description: formData.get("description").trim()
  };
}

function createLocalTicket(payload) {
  const now = new Date().toISOString();
  return {
    id: Date.now(),
    ticketNo: window.HelpdeskStore.makeTicketNo(),
    ...payload,
    status: "รอรับเรื่อง",
    assignee: "",
    solution: "",
    createdAt: now,
    updatedAt: now,
    completedAt: "",
    cancelledAt: ""
  };
}

async function createTicket(payload) {
  if (!canUseApi()) {
    return { ticket: createLocalTicket(payload), telegram: { sent: false, reason: "file_mode" } };
  }

  try {
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "api_error");
    }
    return data;
  } catch {
    return { ticket: createLocalTicket(payload), telegram: { sent: false, reason: "api_unavailable" } };
  }
}

function renderSubmitMessage(ticket, telegram) {
  let telegramText = "";
  if (telegram && telegram.sent) {
    telegramText = "<br>ระบบส่งแจ้งเตือน Telegram ให้ทีม IT แล้ว";
  } else if (telegram && telegram.reason === "missing_token") {
    telegramText = "<br><small>หมายเหตุ: ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN ใน .env</small>";
  } else if (telegram && telegram.reason === "missing_chat_id") {
    telegramText = "<br><small>หมายเหตุ: ยังไม่ได้ตั้งค่า TELEGRAM_CHAT_ID ใน .env</small>";
  } else if (telegram && telegram.reason === "api_unavailable") {
    telegramText = "<br><small>หมายเหตุ: เปิดจากไฟล์หรือ backend ยังไม่พร้อม จึงยังไม่ส่ง Telegram</small>";
  } else if (telegram && telegram.reason) {
    telegramText = "<br><small>หมายเหตุ: ส่ง Telegram ไม่สำเร็จ กรุณาตรวจค่า token/chat id ใน Vercel</small>";
  }
  return `ส่งเรื่องสำเร็จ เลข Ticket ของคุณคือ <strong>${ticket.ticketNo}</strong> ใช้เลขนี้เพื่อติดตามสถานะ${telegramText}`;
}

fillOptions(document.getElementById("department"), window.HelpdeskData.departments, "เลือกแผนก");
fillOptions(document.getElementById("category"), window.HelpdeskData.categories, "เลือกประเภทปัญหา");
fillOptions(document.getElementById("priority"), window.HelpdeskData.priorities, "เลือกระดับความเร่งด่วน");

[
  ["requesterName", "กรุณากรอกชื่อผู้แจ้ง"],
  ["department", "กรุณาเลือกแผนก"],
  ["category", "กรุณาเลือกประเภทปัญหา"],
  ["description", "กรุณากรอกรายละเอียด"]
].forEach(([id, message]) => {
  const field = document.getElementById(id);
  field.addEventListener("invalid", () => field.setCustomValidity(message));
  field.addEventListener("input", () => field.setCustomValidity(""));
  field.addEventListener("change", () => field.setCustomValidity(""));
});

document.getElementById("requestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type=\"submit\"]");
  const defaultButtonText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "กำลังส่งเรื่อง...";

  const formData = new FormData(form);
  const payload = createTicketPayload(formData);
  const { ticket, telegram } = await createTicket(payload);

  const savedTicket = window.HelpdeskStore.addTicket(ticket) || ticket;
  const result = document.getElementById("resultBox");
  result.hidden = false;
  result.innerHTML = renderSubmitMessage(savedTicket, telegram);
  form.reset();
  setFooterMetrics(window.HelpdeskStore.getTickets().length);
  submitButton.disabled = false;
  submitButton.textContent = defaultButtonText;
});

document.getElementById("quickTrackButton").addEventListener("click", () => {
  const ticket = findTicket(document.getElementById("quickTrack").value);
  document.getElementById("quickTrackResult").innerHTML = renderTicket(ticket);
});

setFooterMetrics(window.HelpdeskStore.getTickets().length);

const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(__dirname, "data");
const ticketsFile = path.join(dataDir, "tickets.json");
const envFile = path.join(projectRoot, ".env");
let memoryTickets = [];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function loadEnv() {
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("request_too_large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function getBuddhistYearCode(date) {
  return String(date.getFullYear() + 543).slice(-2);
}

function makeTicketNo(tickets, date) {
  const yearCode = getBuddhistYearCode(date);
  const maxSeq = tickets.reduce((max, ticket) => {
    if (!String(ticket.ticketNo || "").startsWith(`REQ-${yearCode}`)) return max;
    const seq = Number(String(ticket.ticketNo).slice(6));
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `REQ-${yearCode}${String(maxSeq + 1).padStart(4, "0")}`;
}

async function readTickets() {
  try {
    await fsp.mkdir(dataDir, { recursive: true });
    return JSON.parse(await fsp.readFile(ticketsFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    if (error.code === "EPERM" || error.code === "EACCES") return memoryTickets;
    throw error;
  }
}

async function writeTickets(tickets) {
  memoryTickets = tickets;
  try {
    await fsp.mkdir(dataDir, { recursive: true });
    await fsp.writeFile(ticketsFile, JSON.stringify(tickets, null, 2), "utf8");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      console.warn("Ticket file storage is unavailable. Using memory storage for this server session.");
      return;
    }
    throw error;
  }
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function buildTelegramMessage(ticket) {
  return [
    `<b>แจ้งซ่อมใหม่ ${escapeHtml(ticket.ticketNo)}</b>`,
    `ผู้แจ้ง: ${escapeHtml(ticket.requesterName)}`,
    `แผนก: ${escapeHtml(ticket.department)}`,
    `ประเภท: ${escapeHtml(ticket.category)}`,
    `ความเร่งด่วน: ${escapeHtml(ticket.priority)}`,
    `หัวข้อ: ${escapeHtml(ticket.title)}`,
    `รายละเอียด: ${escapeHtml(ticket.description)}`,
    `แจ้งเมื่อ: ${escapeHtml(formatDateTime(ticket.createdAt))}`
  ].join("\n");
}

function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) return Promise.resolve({ sent: false, reason: "missing_token" });
  if (!chatId) return Promise.resolve({ sent: false, reason: "missing_chat_id" });

  const payload = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });

  return new Promise((resolve) => {
    const request = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        let parsedBody = null;
        try {
          parsedBody = body ? JSON.parse(body) : null;
        } catch {
          parsedBody = body;
        }
        resolve({
          sent: response.statusCode >= 200 && response.statusCode < 300,
          statusCode: response.statusCode,
          response: parsedBody
        });
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({ sent: false, reason: "timeout" });
    });
    request.on("error", (error) => {
      resolve({ sent: false, reason: error.message });
    });
    request.write(payload);
    request.end();
  });
}

async function handleListTickets(response) {
  const tickets = await readTickets();
  return sendJson(response, 200, {
    tickets: tickets.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  });
}

async function handleUpdateTicket(request, response) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return sendJson(response, 400, { error: "invalid_json" });
  }

  const ticketNo = String(body.ticketNo || "").trim().toUpperCase();
  if (!/^REQ-\d{6}$/.test(ticketNo)) {
    return sendJson(response, 400, { error: "invalid_ticket_no" });
  }

  const tickets = await readTickets();
  const ticket = tickets.find((item) => item.ticketNo === ticketNo);
  if (!ticket) {
    return sendJson(response, 404, { error: "ticket_not_found" });
  }

  const now = new Date().toISOString();
  if (Object.prototype.hasOwnProperty.call(body, "category")) ticket.category = cleanText(body.category, ticket.category);
  if (Object.prototype.hasOwnProperty.call(body, "assignee")) ticket.assignee = cleanText(body.assignee);
  if (Object.prototype.hasOwnProperty.call(body, "solution")) ticket.solution = cleanText(body.solution);
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    ticket.status = cleanText(body.status, ticket.status);
    if (ticket.status === "เสร็จสิ้น") {
      ticket.completedAt = ticket.completedAt || now;
      ticket.cancelledAt = "";
    } else if (ticket.status === "ยกเลิก") {
      ticket.cancelledAt = ticket.cancelledAt || now;
      ticket.completedAt = "";
    } else {
      ticket.completedAt = "";
      ticket.cancelledAt = "";
    }
  }
  ticket.updatedAt = now;

  await writeTickets(tickets);
  return sendJson(response, 200, { ticket });
}
async function handleCreateTicket(request, response) {
  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return sendJson(response, 400, { error: error.message });
  }

  const requesterName = cleanText(body.requesterName);
  const department = cleanText(body.department);
  const category = cleanText(body.category);
  const description = cleanText(body.description);
  if (!requesterName || !department || !category || !description) {
    return sendJson(response, 400, { error: "required_fields_missing" });
  }

  const now = new Date();
  const tickets = await readTickets();
  const ticket = {
    id: Date.now(),
    ticketNo: makeTicketNo(tickets, now),
    requesterName,
    department,
    category,
    priority: cleanText(body.priority, "-"),
    status: "รอรับเรื่อง",
    assignee: "",
    title: cleanText(body.title, "-"),
    description,
    solution: "",
    attachmentName: cleanText(body.attachmentName),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: "",
    cancelledAt: "",
    source: "server"
  };

  tickets.push(ticket);
  await writeTickets(tickets);
  const telegram = await sendTelegramMessage(buildTelegramMessage(ticket));
  return sendJson(response, 201, { ticket, telegram });
}

async function handleStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(projectRoot, requestPath));
  const relative = path.relative(projectRoot, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }

  try {
    const stats = await fsp.stat(filePath);
    const finalPath = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(finalPath).toLowerCase();
    response.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    return fs.createReadStream(finalPath).pipe(response);
  } catch {
    response.writeHead(404);
    return response.end("Not Found");
  }
}

loadEnv();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/telegram/status") {
      return sendJson(response, 200, {
        configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        hasChatId: Boolean(process.env.TELEGRAM_CHAT_ID)
      });
    }
    if (url.pathname === "/api/tickets") {
      if (request.method === "GET") return handleListTickets(response);
      if (request.method === "POST") return handleCreateTicket(request, response);
      if (request.method === "PATCH") return handleUpdateTicket(request, response);
      response.setHeader("allow", "GET, POST, PATCH");
      return sendJson(response, 405, { error: "method_not_allowed" });
    }
    return handleStatic(request, response);
  } catch (error) {
    return sendJson(response, 500, { error: error.message });
  }
});

const port = Number(process.env.PORT || 3300);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`HelpdeskSystem is running at http://${host}:${port}`);
});

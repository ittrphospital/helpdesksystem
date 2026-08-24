const https = require("https");
const { neon } = require("@neondatabase/serverless");

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
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
        const sent = response.statusCode >= 200 && response.statusCode < 300 && parsedBody?.ok !== false;
        resolve({
          sent,
          statusCode: response.statusCode,
          reason: sent ? "" : "telegram_error",
          telegramDescription: parsedBody?.description || ""
        });
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({ sent: false, reason: "timeout" });
    });
    request.on("error", (error) => {
      resolve({ sent: false, reason: "telegram_error", telegramDescription: error.message });
    });
    request.write(payload);
    request.end();
  });
}

function requireDatabase() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("missing_database_url");
    error.statusCode = 500;
    throw error;
  }
  return neon(process.env.DATABASE_URL);
}
function mapTicketRow(row) {
  return {
    id: row.ticket_id,
    ticketNo: row.ticket_no,
    requesterName: row.requester_name,
    department: row.department_name,
    category: row.category_name,
    priority: row.priority_name,
    status: row.status_name,
    assignee: row.assignee_name || "",
    title: row.title || "-",
    description: row.description || "-",
    solution: row.solution_text || "",
    attachmentName: "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || "",
    cancelledAt: row.cancelled_at || "",
    source: "server"
  };
}

function normalizeTicketNo(value) {
  return String(value || "").trim().toUpperCase();
}

async function getTicketByNo(sql, ticketNo) {
  const rows = await sql`
    select
      t.ticket_id,
      t.ticket_no,
      t.requester_name,
      d.department_name,
      c.category_name,
      p.priority_name,
      s.status_name,
      coalesce(t.assignee_name, '') as assignee_name,
      t.title,
      t.description,
      coalesce(t.solution_text, '') as solution_text,
      t.created_at,
      t.updated_at,
      t.completed_at,
      t.cancelled_at
    from repair_tickets t
    join departments d on d.department_id = t.department_id
    join problem_categories c on c.category_id = t.category_id
    join priority_levels p on p.priority_id = t.priority_id
    join repair_statuses s on s.status_id = t.status_id
    where t.ticket_no = ${ticketNo}
    limit 1
  `;
  return rows[0] ? mapTicketRow(rows[0]) : null;
}

async function ensureSchema(sql) {
  await sql`create extension if not exists pgcrypto`;
  await sql`
    create table if not exists departments (
      department_id uuid primary key default gen_random_uuid(),
      department_name varchar(120) not null unique,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists problem_categories (
      category_id uuid primary key default gen_random_uuid(),
      category_name varchar(120) not null unique,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists priority_levels (
      priority_id uuid primary key default gen_random_uuid(),
      priority_name varchar(80) not null unique,
      sort_order integer not null unique,
      sla_hours integer,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists repair_statuses (
      status_id uuid primary key default gen_random_uuid(),
      status_name varchar(80) not null unique,
      sort_order integer not null unique,
      is_closed boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists repair_tickets (
      ticket_id uuid primary key default gen_random_uuid(),
      ticket_no varchar(32) not null unique,
      requester_name varchar(160) not null,
      department_id uuid not null references departments(department_id),
      category_id uuid not null references problem_categories(category_id),
      priority_id uuid not null references priority_levels(priority_id),
      status_id uuid not null references repair_statuses(status_id),
      assignee_name varchar(160),
      title varchar(220) not null,
      description text not null,
      solution_text text,
      admin_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      completed_at timestamptz,
      cancelled_at timestamptz
    )
  `;
  await sql`
    create table if not exists telegram_notification_logs (
      notification_id uuid primary key default gen_random_uuid(),
      ticket_id uuid references repair_tickets(ticket_id) on delete set null,
      event_name varchar(80) not null,
      chat_id varchar(80),
      message_text text not null,
      sent_at timestamptz,
      is_success boolean not null default false,
      error_message text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists ticket_number_settings (
      year_code varchar(2) primary key,
      next_sequence integer not null check (next_sequence > 0),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create or replace function make_ticket_no()
    returns trigger as $$
    declare
      next_no integer;
      configured_next integer;
      buddhist_year_code text;
    begin
      if new.ticket_no is not null and new.ticket_no <> '' then
        return new;
      end if;

      buddhist_year_code := right(((extract(year from now() at time zone 'Asia/Bangkok')::integer + 543)::text), 2);

      select next_sequence
        into configured_next
        from ticket_number_settings
        where year_code = buddhist_year_code;

      select coalesce(max(substring(ticket_no from 7 for 4)::integer), 0) + 1
        into next_no
        from repair_tickets
        where ticket_no ~ ('^REQ-' || buddhist_year_code || '[0-9]{4}$');

      next_no := greatest(coalesce(configured_next, 1), next_no);
      new.ticket_no := 'REQ-' || buddhist_year_code || lpad(next_no::text, 4, '0');

      insert into ticket_number_settings (year_code, next_sequence, updated_at)
      values (buddhist_year_code, next_no + 1, now())
      on conflict (year_code) do update
        set next_sequence = greatest(ticket_number_settings.next_sequence, excluded.next_sequence),
            updated_at = now();

      return new;
    end;
    $$ language plpgsql
  `;
  await sql`drop trigger if exists trg_repair_tickets_ticket_no on repair_tickets`;
  await sql`
    create trigger trg_repair_tickets_ticket_no
    before insert on repair_tickets
    for each row execute function make_ticket_no()
  `;
}

async function getDepartmentId(sql, departmentName) {
  const rows = await sql`
    insert into departments (department_name)
    values (${departmentName})
    on conflict (department_name) do update set department_name = excluded.department_name
    returning department_id
  `;
  return rows[0].department_id;
}

async function getCategoryId(sql, categoryName) {
  const rows = await sql`
    insert into problem_categories (category_name)
    values (${categoryName})
    on conflict (category_name) do update set category_name = excluded.category_name
    returning category_id
  `;
  return rows[0].category_id;
}

async function getPriorityId(sql, priorityName) {
  const sortOrderByName = { "ต่ำ": 1, "ปานกลาง": 2, "สูง": 3, "เร่งด่วน": 4, "-": 99 };
  const rows = await sql`
    insert into priority_levels (priority_name, sort_order)
    values (${priorityName}, ${sortOrderByName[priorityName] || 99})
    on conflict (priority_name) do update set priority_name = excluded.priority_name
    returning priority_id
  `;
  return rows[0].priority_id;
}

async function getStatusId(sql, statusName) {
  const sortOrderByName = { "รอรับเรื่อง": 1, "กำลังดำเนินการ": 2, "เสร็จสิ้น": 3, "ยกเลิก": 4 };
  const isClosed = statusName === "เสร็จสิ้น" || statusName === "ยกเลิก";
  const rows = await sql`
    insert into repair_statuses (status_name, sort_order, is_closed)
    values (${statusName}, ${sortOrderByName[statusName] || 1}, ${isClosed})
    on conflict (status_name) do update set status_name = excluded.status_name
    returning status_id
  `;
  return rows[0].status_id;
}

async function logTelegram(sql, ticketId, message, telegram) {
  try {
    await sql`
      insert into telegram_notification_logs (
        ticket_id,
        event_name,
        chat_id,
        message_text,
        sent_at,
        is_success,
        error_message
      )
      values (
        ${ticketId},
        'ticket_created',
        ${process.env.TELEGRAM_CHAT_ID || ""},
        ${message},
        ${telegram.sent ? new Date().toISOString() : null},
        ${telegram.sent},
        ${telegram.sent ? "" : telegram.telegramDescription || telegram.reason || "send_failed"}
      )
    `;
  } catch {
    // Do not block ticket creation if notification logging fails.
  }
}

async function listTickets(response) {
  const sql = requireDatabase();
  await ensureSchema(sql);

  const rows = await sql`
    select
      t.ticket_id,
      t.ticket_no,
      t.requester_name,
      d.department_name,
      c.category_name,
      p.priority_name,
      s.status_name,
      coalesce(t.assignee_name, '') as assignee_name,
      t.title,
      t.description,
      coalesce(t.solution_text, '') as solution_text,
      t.created_at,
      t.updated_at,
      t.completed_at,
      t.cancelled_at
    from repair_tickets t
    join departments d on d.department_id = t.department_id
    join problem_categories c on c.category_id = t.category_id
    join priority_levels p on p.priority_id = t.priority_id
    join repair_statuses s on s.status_id = t.status_id
    order by t.created_at desc, t.ticket_no desc
  `;

  return sendJson(response, 200, { tickets: rows.map(mapTicketRow) });
}

async function updateTicket(request, response) {
  const body = request.body || {};
  const ticketNo = normalizeTicketNo(body.ticketNo);
  if (!/^REQ-\d{6}$/.test(ticketNo)) {
    return sendJson(response, 400, { error: "invalid_ticket_no" });
  }

  const sql = requireDatabase();
  await ensureSchema(sql);

  const existingTicket = await getTicketByNo(sql, ticketNo);
  if (!existingTicket) {
    return sendJson(response, 404, { error: "ticket_not_found" });
  }

  if (Object.prototype.hasOwnProperty.call(body, "category")) {
    const category = cleanText(body.category);
    if (category) {
      const categoryId = await getCategoryId(sql, category);
      await sql`update repair_tickets set category_id = ${categoryId}, updated_at = now() where ticket_no = ${ticketNo}`;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = cleanText(body.status);
    if (status) {
      const statusId = await getStatusId(sql, status);
      const completedAt = status === "เสร็จสิ้น" ? new Date().toISOString() : null;
      const cancelledAt = status === "ยกเลิก" ? new Date().toISOString() : null;
      await sql`
        update repair_tickets
        set status_id = ${statusId},
            completed_at = ${completedAt},
            cancelled_at = ${cancelledAt},
            updated_at = now()
        where ticket_no = ${ticketNo}
      `;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "assignee")) {
    await sql`update repair_tickets set assignee_name = ${cleanText(body.assignee)}, updated_at = now() where ticket_no = ${ticketNo}`;
  }

  if (Object.prototype.hasOwnProperty.call(body, "solution")) {
    await sql`update repair_tickets set solution_text = ${cleanText(body.solution)}, updated_at = now() where ticket_no = ${ticketNo}`;
  }

  const ticket = await getTicketByNo(sql, ticketNo);
  return sendJson(response, 200, { ticket });
}
async function createTicket(request, response) {
  const body = request.body || {};
  const requesterName = cleanText(body.requesterName);
  const department = cleanText(body.department);
  const category = cleanText(body.category);
  const description = cleanText(body.description);

  if (!requesterName || !department || !category || !description) {
    return sendJson(response, 400, { error: "required_fields_missing" });
  }

  const priority = cleanText(body.priority, "-");
  const status = "รอรับเรื่อง";
  const sql = requireDatabase();

  await ensureSchema(sql);

  const departmentId = await getDepartmentId(sql, department);
  const categoryId = await getCategoryId(sql, category);
  const priorityId = await getPriorityId(sql, priority);
  const statusId = await getStatusId(sql, status);

  const rows = await sql`
    insert into repair_tickets (
      requester_name,
      department_id,
      category_id,
      priority_id,
      status_id,
      assignee_name,
      title,
      description,
      solution_text
    )
    values (
      ${requesterName},
      ${departmentId},
      ${categoryId},
      ${priorityId},
      ${statusId},
      '',
      ${cleanText(body.title, "-")},
      ${description},
      ''
    )
    returning ticket_id, ticket_no, requester_name, title, description, created_at, updated_at
  `;

  const inserted = rows[0];
  const ticket = {
    id: inserted.ticket_id,
    ticketNo: inserted.ticket_no,
    requesterName: inserted.requester_name,
    department,
    category,
    priority,
    status,
    assignee: "",
    title: inserted.title,
    description: inserted.description,
    solution: "",
    attachmentName: cleanText(body.attachmentName),
    createdAt: inserted.created_at,
    updatedAt: inserted.updated_at,
    completedAt: "",
    cancelledAt: "",
    source: "server"
  };

  const message = buildTelegramMessage(ticket);
  const telegram = await sendTelegramMessage(message);
  await logTelegram(sql, inserted.ticket_id, message, telegram);

  return sendJson(response, 201, { ticket, telegram });
}

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      return await listTickets(response);
    }
    if (request.method === "POST") {
      return await createTicket(request, response);
    }
    if (request.method === "PATCH") {
      return await updateTicket(request, response);
    }

    response.setHeader("allow", "GET, POST, PATCH");
    return sendJson(response, 405, { error: "method_not_allowed" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendJson(response, statusCode, { error: error.message || "server_error" });
  }
};

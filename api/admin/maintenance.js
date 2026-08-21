function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function normalizeTicketNo(value) {
  return String(value || "").trim().toUpperCase();
}

function isTicketNo(value) {
  return /^REQ-\d{6}$/.test(value || "");
}

function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body;
}

function requireMaintenanceKey(request, body) {
  const configuredKey = process.env.ADMIN_MAINTENANCE_KEY;
  if (!configuredKey) {
    const error = new Error("maintenance_key_not_configured");
    error.statusCode = 403;
    throw error;
  }

  const providedKey = request.headers["x-admin-maintenance-key"] || body.maintenanceKey || "";
  if (providedKey !== configuredKey) {
    const error = new Error("invalid_maintenance_key");
    error.statusCode = 401;
    throw error;
  }
}

function requireDatabase() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("missing_database_url");
    error.statusCode = 500;
    throw error;
  }
  const { neon } = require("@neondatabase/serverless");
  return neon(process.env.DATABASE_URL);
}

async function ensureMaintenanceSchema(sql) {
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

async function getSequenceStatus(sql, yearCode) {
  const rows = await sql`
    select
      coalesce(max(substring(ticket_no from 7 for 4)::integer), 0) as max_sequence,
      (select next_sequence from ticket_number_settings where year_code = ${yearCode}) as configured_sequence
    from repair_tickets
    where ticket_no ~ ('^REQ-' || ${yearCode} || '[0-9]{4}$')
  `;
  const maxSequence = Number(rows[0]?.max_sequence || 0);
  const configuredSequence = Number(rows[0]?.configured_sequence || 0);
  const effectiveSequence = Math.max(maxSequence + 1, configuredSequence || 1);
  return {
    yearCode,
    maxTicketNo: maxSequence > 0 ? `REQ-${yearCode}${String(maxSequence).padStart(4, "0")}` : "",
    configuredNextTicketNo: configuredSequence > 0 ? `REQ-${yearCode}${String(configuredSequence).padStart(4, "0")}` : "",
    effectiveNextTicketNo: `REQ-${yearCode}${String(effectiveSequence).padStart(4, "0")}`
  };
}

async function setNextTicketNo(sql, ticketNo) {
  const nextTicketNo = normalizeTicketNo(ticketNo);
  if (!isTicketNo(nextTicketNo)) {
    const error = new Error("invalid_ticket_no");
    error.statusCode = 400;
    throw error;
  }

  const yearCode = nextTicketNo.slice(4, 6);
  const sequence = Number(nextTicketNo.slice(6));
  await sql`
    insert into ticket_number_settings (year_code, next_sequence, updated_at)
    values (${yearCode}, ${sequence}, now())
    on conflict (year_code) do update
      set next_sequence = excluded.next_sequence,
          updated_at = now()
  `;
  return getSequenceStatus(sql, yearCode);
}

async function clearTickets(sql, nextTicketNo) {
  await sql`
    do $$
    begin
      if to_regclass('ticket_attachments') is not null then
        execute 'delete from ticket_attachments';
      end if;
      if to_regclass('telegram_notification_logs') is not null then
        execute 'delete from telegram_notification_logs';
      end if;
      if to_regclass('telegram_notifications') is not null then
        execute 'delete from telegram_notifications';
      end if;
    end $$
  `;
  await sql`delete from repair_tickets`;
  return setNextTicketNo(sql, nextTicketNo);
}

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.setHeader("allow", "POST");
      return sendJson(response, 405, { error: "method_not_allowed" });
    }

    const body = parseBody(request);
    requireMaintenanceKey(request, body);

    const sql = requireDatabase();
    await ensureMaintenanceSchema(sql);

    if (body.action === "setNextTicketNo") {
      const status = await setNextTicketNo(sql, body.nextTicketNo);
      return sendJson(response, 200, { ok: true, action: body.action, status });
    }

    if (body.action === "clearTickets") {
      const status = await clearTickets(sql, body.nextTicketNo);
      return sendJson(response, 200, { ok: true, action: body.action, status });
    }

    const yearCode = isTicketNo(body.nextTicketNo) ? normalizeTicketNo(body.nextTicketNo).slice(4, 6) : String(new Date().getFullYear() + 543).slice(-2);
    const status = await getSequenceStatus(sql, yearCode);
    return sendJson(response, 200, { ok: true, action: "status", status });
  } catch (error) {
    return sendJson(response, error.statusCode || 500, { error: error.message || "server_error" });
  }
};

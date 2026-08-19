-- HelpdeskSystem PostgreSQL/Neon schema
-- Run this file in Neon SQL Editor or psql.

create extension if not exists pgcrypto;

create table if not exists admin_users (
  admin_user_id uuid primary key default gen_random_uuid(),
  username varchar(60) not null unique,
  password_hash text not null,
  display_name varchar(160) not null,
  role varchar(30) not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_role_check check (role in ('admin'))
);

create table if not exists departments (
  department_id uuid primary key default gen_random_uuid(),
  department_name varchar(120) not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists problem_categories (
  category_id uuid primary key default gen_random_uuid(),
  category_name varchar(120) not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists priority_levels (
  priority_id uuid primary key default gen_random_uuid(),
  priority_name varchar(80) not null unique,
  sort_order integer not null unique,
  sla_hours integer,
  created_at timestamptz not null default now()
);

create table if not exists repair_statuses (
  status_id uuid primary key default gen_random_uuid(),
  status_name varchar(80) not null unique,
  sort_order integer not null unique,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

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
);

create table if not exists ticket_status_history (
  history_id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references repair_tickets(ticket_id) on delete cascade,
  old_status_id uuid references repair_statuses(status_id),
  new_status_id uuid not null references repair_statuses(status_id),
  changed_by_admin_user_id uuid references admin_users(admin_user_id),
  changed_note text,
  changed_at timestamptz not null default now()
);

create table if not exists ticket_attachments (
  attachment_id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references repair_tickets(ticket_id) on delete cascade,
  original_file_name varchar(255) not null,
  stored_file_name varchar(255),
  mime_type varchar(120),
  file_size_bytes bigint,
  file_url text,
  created_at timestamptz not null default now()
);

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
);

create index if not exists idx_repair_tickets_created_at on repair_tickets(created_at desc);
create index if not exists idx_repair_tickets_status on repair_tickets(status_id);
create index if not exists idx_repair_tickets_department on repair_tickets(department_id);
create index if not exists idx_repair_tickets_category on repair_tickets(category_id);
create index if not exists idx_repair_tickets_priority on repair_tickets(priority_id);
create index if not exists idx_repair_tickets_assignee_name on repair_tickets(assignee_name);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_admin_users_updated_at on admin_users;
create trigger trg_admin_users_updated_at
before update on admin_users
for each row execute function set_updated_at();

drop trigger if exists trg_repair_tickets_updated_at on repair_tickets;
create trigger trg_repair_tickets_updated_at
before update on repair_tickets
for each row execute function set_updated_at();

create or replace function make_ticket_no()
returns trigger as $$
declare
  next_no integer;
  buddhist_year_code text;
begin
  if new.ticket_no is not null and new.ticket_no <> '' then
    return new;
  end if;

  buddhist_year_code := right(((extract(year from now() at time zone 'Asia/Bangkok')::integer + 543)::text), 2);
  select coalesce(max(substring(ticket_no from 7 for 4)::integer), 0) + 1
    into next_no
    from repair_tickets
    where ticket_no ~ ('^REQ-' || buddhist_year_code || '[0-9]{4}$');

  new.ticket_no := 'REQ-' || buddhist_year_code || lpad(next_no::text, 4, '0');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_repair_tickets_ticket_no on repair_tickets;
create trigger trg_repair_tickets_ticket_no
before insert on repair_tickets
for each row execute function make_ticket_no();

create or replace view vw_repair_ticket_dashboard as
select
  t.ticket_id,
  t.ticket_no,
  t.requester_name,
  d.department_name,
  c.category_name,
  p.priority_name,
  p.sort_order as priority_sort_order,
  p.sla_hours,
  s.status_name,
  s.sort_order as status_sort_order,
  s.is_closed,
  coalesce(nullif(t.assignee_name, ''), 'ยังไม่มอบหมาย') as assignee_name,
  t.title,
  t.description,
  t.solution_text,
  t.admin_note,
  t.created_at,
  t.updated_at,
  t.completed_at,
  t.cancelled_at,
  date_trunc('month', t.created_at)::date as reported_month,
  case
    when p.sla_hours is null then false
    when s.is_closed and t.completed_at is not null then t.completed_at > t.created_at + (p.sla_hours || ' hours')::interval
    else now() > t.created_at + (p.sla_hours || ' hours')::interval
  end as is_breached_sla
from repair_tickets t
join departments d on d.department_id = t.department_id
join problem_categories c on c.category_id = t.category_id
join priority_levels p on p.priority_id = t.priority_id
join repair_statuses s on s.status_id = t.status_id;

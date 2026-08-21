create table if not exists ticket_number_settings (
  year_code varchar(2) primary key,
  next_sequence integer not null check (next_sequence > 0),
  updated_at timestamptz not null default now()
);

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
$$ language plpgsql;

drop trigger if exists trg_repair_tickets_ticket_no on repair_tickets;
create trigger trg_repair_tickets_ticket_no
before insert on repair_tickets
for each row execute function make_ticket_no();

-- Optional manual setup example:
-- insert into ticket_number_settings (year_code, next_sequence)
-- values ('69', 81)
-- on conflict (year_code) do update set next_sequence = excluded.next_sequence, updated_at = now();

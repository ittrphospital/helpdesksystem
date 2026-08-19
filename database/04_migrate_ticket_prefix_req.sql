update repair_tickets
set ticket_no = 'REQ-' || substring(ticket_no from 4)
where ticket_no ~ '^IT-[0-9]{6}$'
  and not exists (
    select 1
    from repair_tickets existing
    where existing.ticket_no = 'REQ-' || substring(repair_tickets.ticket_no from 4)
  );

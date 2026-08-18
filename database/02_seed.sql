-- HelpdeskSystem sample data for PostgreSQL/Neon
-- Includes lookup data and 2 sample repair tickets.

insert into admin_users (username, password_hash, display_name, role)
values
  ('admin', crypt('admin123', gen_salt('bf')), 'System Administrator', 'admin')
on conflict (username) do nothing;

insert into departments (department_name) values
  ('การเงิน'),
  ('การตลาด'),
  ('ขาย'),
  ('คลังสินค้า'),
  ('จป. วิชาชีพ'),
  ('จัดซื้อ'),
  ('นักลงทุนสัมพันธ์'),
  ('บริหารทั่วไป'),
  ('บุคคล'),
  ('บัญชี'),
  ('ผู้ป่วยนอก'),
  ('พัฒนาธุรกิจ'),
  ('เภสัช'),
  ('เวชระเบียน'),
  ('สกิน'),
  ('ห้องผ่าตัด'),
  ('อาคารสถานที่'),
  ('แอดมิน')
on conflict (department_name) do nothing;

insert into problem_categories (category_name) values
  ('อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง'),
  ('ซอฟต์แวร์และโปรแกรมประยุกต์'),
  ('ระบบเครือข่ายและอินเทอร์เน็ต'),
  ('บัญชีผู้ใช้งานและสิทธิ์การเข้าถึง'),
  ('ระบบสารสนเทศโรงพยาบาล HIS'),
  ('อื่นๆ')
on conflict (category_name) do nothing;

insert into priority_levels (priority_name, sort_order, sla_hours) values
  ('ต่ำ', 1, 72),
  ('ปานกลาง', 2, 48),
  ('สูง', 3, 24),
  ('เร่งด่วน', 4, 4)
on conflict (priority_name) do nothing;

insert into repair_statuses (status_name, sort_order, is_closed) values
  ('รอรับเรื่อง', 1, false),
  ('กำลังดำเนินการ', 2, false),
  ('เสร็จสิ้น', 3, true),
  ('ยกเลิก', 4, true)
on conflict (status_name) do nothing;

insert into repair_tickets (
  ticket_no,
  requester_name,
  department_id,
  category_id,
  priority_id,
  status_id,
  assignee_name,
  title,
  description,
  solution_text,
  created_at
)
select
  'IT-690001',
  'วชิรวิทย์ คงดี',
  d.department_id,
  c.category_id,
  p.priority_id,
  s.status_id,
  'ทีม IT Support',
  'เครื่องพิมพ์แผนกบัญชีพิมพ์ไม่ออก',
  'เครื่องพิมพ์ขึ้นสถานะ offline แม้เปิดเครื่องแล้ว ต้องการให้ตรวจสอบด่วน',
  '',
  '2026-08-17 09:20:00+07'
from departments d
join problem_categories c on c.category_name = 'อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง'
join priority_levels p on p.priority_name = 'สูง'
join repair_statuses s on s.status_name = 'รอรับเรื่อง'
where d.department_name = 'บัญชี'
on conflict (ticket_no) do nothing;

insert into repair_tickets (
  ticket_no,
  requester_name,
  department_id,
  category_id,
  priority_id,
  status_id,
  assignee_name,
  title,
  description,
  solution_text,
  created_at
)
select
  'IT-690002',
  'สุภาวดี แสงทอง',
  d.department_id,
  c.category_id,
  p.priority_id,
  s.status_id,
  'ผู้ดูแลระบบ',
  'เข้าใช้งานระบบ HR ไม่ได้',
  'ระบบแจ้งว่ารหัสผ่านไม่ถูกต้อง หลังจากเปลี่ยนรหัสผ่านเมื่อเช้า',
  '',
  '2026-08-17 10:05:00+07'
from departments d
join problem_categories c on c.category_name = 'บัญชีผู้ใช้งานและสิทธิ์การเข้าถึง'
join priority_levels p on p.priority_name = 'ปานกลาง'
join repair_statuses s on s.status_name = 'กำลังดำเนินการ'
where d.department_name = 'แอดมิน'
on conflict (ticket_no) do nothing;

insert into ticket_attachments (ticket_id, original_file_name, mime_type)
select ticket_id, 'printer-error.jpg', 'image/jpeg'
from repair_tickets
where ticket_no = 'IT-690001'
on conflict do nothing;

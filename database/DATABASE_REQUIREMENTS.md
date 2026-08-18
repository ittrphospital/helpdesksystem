# HelpdeskSystem Database Requirements

## เป้าหมายระบบ

ระบบ HelpdeskSystem ใช้สำหรับรับแจ้งซ่อมจากผู้ใช้งานทั่วไป ติดตามสถานะใบงาน และให้ admin ดูภาพรวมงานแจ้งซ่อมผ่าน dashboard

## ขอบเขตพื้นฐาน

1. ผู้ใช้แจ้งซ่อมได้โดยกรอกชื่อผู้แจ้ง แผนก ประเภทปัญหา รายละเอียด แนบรูป และระดับความเร่งด่วน
2. ผู้ใช้ติดตามสถานะได้ด้วยเลข Ticket
3. Admin เข้าสู่ระบบด้วย username/password แบบพื้นฐาน
4. Admin เห็นรายการทั้งหมด ค้นหา กรอง และเปลี่ยนสถานะได้
5. สถานะงานมี 4 สถานะ: รอรับเรื่อง, กำลังดำเนินการ, เสร็จสิ้น, ยกเลิก
6. ระบบเตรียมตารางสำหรับบันทึกประวัติการเปลี่ยนสถานะ
7. ระบบเตรียมตารางสำหรับเก็บ metadata ของไฟล์แนบ
8. ระบบเตรียมตาราง log สำหรับ Telegram notification เมื่อมีใบแจ้งซ่อมใหม่

## สิทธิ์ผู้ใช้งาน

เวอร์ชันพื้นฐานใช้ role เดียวคือ `admin`

- เห็นใบแจ้งซ่อมทั้งหมด
- ค้นหาและกรองข้อมูล
- เปลี่ยนสถานะงาน
- ดูข้อมูล dashboard

## ตารางหลัก

- `admin_users`
- `departments`
- `problem_categories`
- `priority_levels`
- `repair_statuses`
- `repair_tickets`
- `ticket_status_history`
- `ticket_attachments`
- `telegram_notification_logs`

## การเก็บไฟล์แนบ

PostgreSQL/Neon ไม่เหมาะกับการเก็บรูปภาพจริงในตารางโดยตรงในระบบใช้งานจริง
แนะนำให้เก็บไฟล์ไว้ใน object storage แล้วบันทึกเฉพาะ metadata เช่น file name, mime type, file size และ URL/path ลงใน `ticket_attachments`

## Telegram API

เมื่อ API สร้าง ticket สำเร็จ ให้เรียก Telegram Bot API:

`POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage`

เนื้อหาข้อความควรมี:

- Ticket No
- ผู้แจ้ง
- แผนก
- ประเภทปัญหา
- ความเร่งด่วน
- รายละเอียดแบบย่อ

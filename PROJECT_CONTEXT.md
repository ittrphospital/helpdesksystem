# PROJECT_CONTEXT.md

สรุปโปรเจกต์สำหรับเริ่ม Codex Task ใหม่แบบประหยัด token

## Project

- ชื่อระบบ: HelpdeskSystem
- โฟลเดอร์หลัก: `D:\1 PROJECTS\ITHelpdekSystem`
- GitHub repo: `https://github.com/ittrphospital/helpdesksystem.git`
- Production URL: `https://trp-helpdesksystem.vercel.app`
- Hosting: Vercel
- Database: PostgreSQL/Neon
- Notification: Telegram Bot API
- Runtime: Node.js >= 18
- Font หลัก: Noto Sans Thai

## โครงสร้างโปรเจกต์

```text
ITHelpdekSystem/
├─ index.html                  # หน้าเลือกเข้า Admin Dashboard หรือ User Request
├─ admin/                      # หน้า login และ Admin Dashboard
├─ userrequest/                # หน้าแจ้งซ่อมและหน้าติดตามสถานะผู้ใช้งาน
├─ api/                        # Vercel Serverless API
├─ server/                     # backend local สำหรับทดสอบผ่าน Node
├─ database/                   # SQL schema, seed, migration, requirements
├─ shared/                     # CSS/JS/asset ที่ใช้ร่วมกัน
├─ README.md                   # คำอธิบายโปรเจกต์
├─ GITHUB_UPLOAD_STEPS.md      # ขั้นตอน upload/commit/push
├─ package.json                # dependency และ script
└─ .env.example                # ตัวอย่าง environment variables ห้ามใส่ secret จริง
```

## ไฟล์สำคัญ

### หน้าแรก

- `index.html`
- `shared/layout.css`

### User Request

- `userrequest/index.html` - ฟอร์มแจ้งซ่อม
- `userrequest/userrequest.css` - style เฉพาะหน้าแจ้งซ่อม
- `userrequest/userrequest.js` - submit ใบแจ้งซ่อมผ่าน API
- `userrequest/track.html` - หน้าติดตามสถานะ
- `userrequest/track.js` - logic ติดตามสถานะ

### Admin Dashboard

- `admin/login.html` - หน้า login admin
- `admin/login.js` - login พื้นฐาน
- `admin/index.html` - dashboard และตารางรายการแจ้งซ่อม
- `admin/admin.css` - style admin
- `admin/admin.js` - dashboard, table, import/export Excel, update field

### API / Backend

- `api/tickets.js` - Vercel API สำหรับรับข้อมูลแจ้งซ่อม บันทึก Neon และส่ง Telegram
- `api/telegram/status.js` - ตรวจสถานะ env ของ Telegram/Database
- `api/admin/maintenance.js` - API สำหรับล้างข้อมูลและตั้งเลข Ticket ถัดไป
- `server/server.js` - local backend สำหรับทดสอบบนเครื่อง

### Database

- `database/01_schema.sql` - schema หลัก
- `database/02_seed.sql` - seed data
- `database/03_api_contract.md` - contract API
- `database/04_migrate_ticket_prefix_req.sql` - migration เปลี่ยน prefix เป็น REQ
- `database/05_ticket_sequence_settings.sql` - ตั้งค่าเลข Ticket ถัดไป
- `database/DATABASE_REQUIREMENTS.md` - requirement ฐานข้อมูล

## Environment Variables

ใส่ใน `.env` สำหรับ local และ Vercel Project Settings สำหรับ production

```env
PORT=3300
HOST=127.0.0.1
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
ADMIN_MAINTENANCE_KEY=...
```

ข้อควรระวัง:

- ห้าม commit ไฟล์ `.env`
- ใช้ `.env.example` เป็นตัวอย่างเท่านั้น
- ถ้าเพิ่มหรือแก้ env บน Vercel ต้อง Redeploy ก่อนใช้งานจริง

## API Endpoints

Production base URL:

```text
https://trp-helpdesksystem.vercel.app
```

### Tickets

```text
POST /api/tickets
```

หน้าที่:

- รับข้อมูลจากหน้า `userrequest`
- validate field สำคัญ
- บันทึกลง Neon
- สร้างเลข Ticket รูปแบบ `REQ-YY0001`
- ส่ง Telegram notification เมื่อมีใบแจ้งซ่อมใหม่

### Telegram Status

```text
GET /api/telegram/status
```

ใช้ตรวจว่า Vercel ตั้งค่า env ครบหรือไม่

ผลที่ควรได้เมื่อพร้อมใช้งาน:

```json
{
  "configured": true,
  "hasToken": true,
  "hasChatId": true,
  "hasDatabaseUrl": true
}
```

### Admin Maintenance

```text
POST /api/admin/maintenance
```

ต้องใช้ `ADMIN_MAINTENANCE_KEY`

Actions:

- `status` - ตรวจเลข Ticket ปัจจุบัน
- `setNextTicketNo` - ตั้งเลข Ticket ถัดไป เช่น `REQ-690081`
- `clearTickets` - ล้างข้อมูลใบแจ้งซ่อม และตั้งเลข Ticket ถัดไปใหม่

ตัวอย่าง payload:

```json
{
  "maintenanceKey": "ใส่รหัสจาก ADMIN_MAINTENANCE_KEY",
  "action": "setNextTicketNo",
  "nextTicketNo": "REQ-690081"
}
```

## Neon Tables หลัก

- `admin_users`
- `departments`
- `problem_categories`
- `priority_levels`
- `repair_statuses`
- `repair_tickets`
- `ticket_status_history`
- `ticket_attachments`
- `telegram_notification_logs`
- `ticket_number_settings`
- view: `vw_repair_ticket_dashboard`

## Ticket Number Rule

รูปแบบปัจจุบัน:

```text
REQ-YY0001
```

ความหมาย:

- `REQ` = prefix ใบแจ้งซ่อม
- `YY` = ปี พ.ศ. 2 หลักท้าย เช่น พ.ศ. 2569 ใช้ `69`
- `0001` = running number 4 หลัก

ตัวอย่าง:

```text
REQ-690001
REQ-690080
REQ-690081
```

เมื่อขึ้นปี พ.ศ. ใหม่ ระบบควรเริ่มเลขใหม่ตามปีนั้น เช่น:

```text
REQ-700001
```

## คำสั่งใช้งานบ่อย

### เปิด local server

```powershell
cd "D:\1 PROJECTS\ITHelpdekSystem"
npm install
npm start
```

Local URL:

```text
http://127.0.0.1:3300/userrequest/index.html
http://127.0.0.1:3300/admin/index.html
```

### ตรวจสถานะ Git

```powershell
cd "D:\1 PROJECTS\ITHelpdekSystem"
git status --short
```

### Commit / Push

```powershell
cd "D:\1 PROJECTS\ITHelpdekSystem"
git status --short
git add .
git commit -m "Update project"
git push origin main
```

### ตรวจ Vercel API หลัง deploy

เปิด browser:

```text
https://trp-helpdesksystem.vercel.app/api/telegram/status
```

หรือใช้ PowerShell:

```powershell
Invoke-RestMethod "https://trp-helpdesksystem.vercel.app/api/telegram/status"
```

## แนวทางเริ่ม Codex Task ใหม่ให้ประหยัด token

ใช้ prompt แบบนี้เมื่อเปิด task ใหม่:

```text
โปรเจกต์: D:\1 PROJECTS\ITHelpdekSystem

อ่าน PROJECT_CONTEXT.md ก่อน
Task นี้ทำเฉพาะ: <ระบุส่วนงาน เช่น userrequest / admin / api / database>
เป้าหมาย: <อธิบายสั้น ๆ ว่าต้องแก้อะไร>

ให้อ่านเฉพาะไฟล์ที่เกี่ยวข้องเท่านั้น
ห้ามแก้ไฟล์นอกขอบเขต ถ้าไม่จำเป็น
หลังแก้ให้สรุปไฟล์ที่เปลี่ยน
ยังไม่ต้อง commit/push เว้นแต่สั่งชัดเจน
```

ตัวอย่างสำหรับหน้า userrequest:

```text
โปรเจกต์: D:\1 PROJECTS\ITHelpdekSystem
อ่าน PROJECT_CONTEXT.md ก่อน

Task นี้ทำเฉพาะหน้า userrequest
แก้เฉพาะ:
- userrequest/index.html
- userrequest/userrequest.css
- userrequest/userrequest.js

ห้ามแก้:
- admin/
- api/
- database/

หลังแก้ให้ตรวจ diff และสรุปผล ยังไม่ต้อง commit/push
```

ตัวอย่างสำหรับ API:

```text
โปรเจกต์: D:\1 PROJECTS\ITHelpdekSystem
อ่าน PROJECT_CONTEXT.md ก่อน

Task นี้ทำเฉพาะ API / Neon / Telegram
แก้เฉพาะ:
- api/
- database/
- server/

ห้ามแก้ UI เว้นแต่จำเป็น
หลังแก้ให้ตรวจ syntax และบอก env ที่ต้องตั้งใน Vercel
```

## สิ่งที่แก้ล่าสุด / สถานะล่าสุด

- Git branch: `main`
- Remote: `origin/main`
- Commit ล่าสุดที่ตรวจพบตอนสร้างไฟล์นี้: `97d722d Update project`
- Repo ก่อนสร้างไฟล์นี้อยู่ในสถานะ clean
- เพิ่มไฟล์นี้เพื่อใช้เป็น context กลางสำหรับ task ใหม่ และช่วยลด token ในการอธิบายโปรเจกต์ซ้ำ

## ข้อควรจำสำหรับการทำงานต่อ

- ถ้าแก้ UI อย่างเดียว ไม่ต้องแตะ Neon หรือ Vercel env
- ถ้าแก้ API หรือ env ต้อง push แล้วรอ Vercel redeploy
- ถ้าแก้ schema database ต้องนำ SQL ไปรันใน Neon ด้วย
- ถ้า Telegram ไม่ส่ง ให้ตรวจ `/api/telegram/status` ก่อน
- ถ้าเลข Ticket ไม่ต่อ ให้ตรวจ `ticket_number_settings` และ `/api/admin/maintenance`
- ถ้าใช้ภาพประกอบ ให้ crop เฉพาะจุดที่ต้องแก้ เพื่อลด token

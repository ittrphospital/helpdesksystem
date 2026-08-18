# HelpdeskSystem

ระบบแจ้งซ่อม HelpdeskSystem แยกเป็น 2 ส่วนหลัก

- `admin/` สำหรับหน้า Admin Dashboard และหน้าเข้าสู่ระบบแบบพื้นฐาน
- `userrequest/` สำหรับหน้าแจ้งซ่อมและติดตามสถานะของผู้ใช้งาน
- `shared/` สำหรับไฟล์ข้อมูลตัวอย่างและ JavaScript ที่ใช้ร่วมกัน
- `database/` สำหรับ PostgreSQL/Neon schema, seed data และ API contract
- `server/` สำหรับ backend ขนาดเล็กที่รับข้อมูลแจ้งซ่อมและส่ง Telegram notification
- `GITHUB_UPLOAD_STEPS.md` สำหรับขั้นตอนอัปโหลดโปรเจกต์ขึ้น GitHub อย่างปลอดภัย

## สิ่งที่มีในเวอร์ชันนี้

- หน้า Admin Dashboard แบบ responsive
- หน้า User Request สำหรับแจ้งซ่อมและติดตามสถานะ
- เมนู fixed top, smooth scroll, hamburger menu บนมือถือ
- ปุ่ม scroll to top
- Footer แบบ dynamic คล้าย dashboard footer ของ Power BI
- ใช้ฟอนต์ Noto Sans Thai
- ใช้ข้อมูลตัวอย่าง 2 รายการจากไฟล์ `shared/sample-data.js`
- เตรียม SQL schema สำหรับ PostgreSQL/Neon
- เชื่อม Telegram notification ผ่าน backend โดยอ่าน token จาก `.env`

## วิธีเปิดดู

เปิดไฟล์เหล่านี้ใน browser ได้โดยตรง

- `index.html`
- `admin/login.html`
- `admin/index.html`
- `userrequest/index.html`
- `userrequest/track.html`

หากต้องการทดสอบการส่ง Telegram ให้รันผ่าน backend

```powershell
cd "D:\1 PROJECTS\ITHelpdekSystem"
copy .env.example .env
node server/server.js
```

จากนั้นเปิด

- `http://127.0.0.1:3300/userrequest/index.html`
- `http://127.0.0.1:3300/admin/index.html`

## ตั้งค่า Telegram

ไฟล์ `.env` ใช้เก็บค่าลับของ Telegram และไม่ควรนำขึ้น Git

```env
PORT=3300
HOST=127.0.0.1
TELEGRAM_BOT_TOKEN=token_จาก_BotFather
TELEGRAM_CHAT_ID=chat_id_ของผู้รับหรือกลุ่ม
```

ขั้นตอนหา `TELEGRAM_CHAT_ID`

1. ส่งข้อความหา bot หรือเพิ่ม bot เข้า group ที่ต้องการรับแจ้งเตือน
2. เปิด URL `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`
3. คัดลอกค่า `chat.id` มาใส่ใน `TELEGRAM_CHAT_ID`
4. ปิดและเปิด server ใหม่ แล้วทดสอบส่งใบแจ้งซ่อมจากหน้า user

## หมายเหตุ

เวอร์ชันนี้ส่ง Telegram ได้เมื่อกำหนด `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_CHAT_ID` แล้ว ส่วน PostgreSQL/Neon ยังอยู่ในรูปแบบ schema และ seed data สำหรับเชื่อมต่อในขั้นถัดไป

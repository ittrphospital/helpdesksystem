# ขั้นตอนอัปโหลด HelpdeskSystem ไปยัง GitHub

คู่มือนี้ใช้สำหรับอัปโหลดไฟล์ทั้งหมดของโปรเจกต์ `HelpdeskSystem` จากเครื่องนี้ไปยัง GitHub อย่างปลอดภัย

## 1. ตรวจสอบไฟล์ลับก่อนอัปโหลด

ไฟล์ `.env` ต้องไม่ถูกอัปโหลดขึ้น GitHub เพราะมีค่า token และค่าการเชื่อมต่อระบบ

โปรเจกต์นี้เตรียม `.gitignore` ไว้แล้ว โดยกันไฟล์เหล่านี้:

```gitignore
.env
server/data/tickets.json
node_modules/
```

ไฟล์ที่ควรอัปโหลดคือ `.env.example` เพื่อเป็นตัวอย่างให้ตั้งค่าภายหลัง

## 2. เปิด Terminal ที่โฟลเดอร์โปรเจกต์

```powershell
cd "D:\1 PROJECTS\ITHelpdekSystem"
```

## 3. เริ่มต้น Git repository

ใช้คำสั่งนี้เมื่อโฟลเดอร์ยังไม่เคยเป็น Git repository

```powershell
git init
git branch -M main
```

## 4. ตรวจสอบไฟล์ที่จะถูกอัปโหลด

```powershell
git status --short
```

ให้ตรวจว่าไม่มีไฟล์ `.env` แสดงอยู่ในรายการ

ถ้ามี `.env` แสดงขึ้นมา ให้หยุดก่อน แล้วตรวจไฟล์ `.gitignore`

## 5. เพิ่มไฟล์ทั้งหมดเข้า Git

```powershell
git add .
git status --short
```

ตรวจซ้ำอีกครั้งว่า `.env` ไม่ถูกเพิ่มเข้า Git

## 6. Commit ไฟล์

```powershell
git commit -m "Initial HelpdeskSystem project"
```

ถ้า Git แจ้งว่ายังไม่ได้ตั้งชื่อหรืออีเมล ให้ตั้งค่าก่อน:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

จากนั้นสั่ง commit อีกครั้ง

## 7. สร้าง repository บน GitHub

1. เข้า GitHub
2. เลือก New repository
3. ตั้งชื่อ repository เช่น `HelpdeskSystem`
4. เลือก Public หรือ Private ตามต้องการ
5. ไม่ต้องเลือก Add README, .gitignore หรือ license เพราะโปรเจกต์มีไฟล์อยู่แล้ว
6. กด Create repository

## 8. เชื่อม local project กับ GitHub

นำ URL ของ repository ที่ GitHub สร้างให้มาใช้

ตัวอย่างแบบ HTTPS:

```powershell
git remote add origin https://github.com/USERNAME/HelpdeskSystem.git
```

ถ้ามี remote อยู่แล้วและต้องการเปลี่ยน URL:

```powershell
git remote set-url origin https://github.com/USERNAME/HelpdeskSystem.git
```

## 9. Push ขึ้น GitHub

```powershell
git push -u origin main
```

หลังจากนี้ไฟล์โปรเจกต์จะอยู่บน GitHub

## 10. วิธีตั้งค่าหลัง clone หรือ deploy

หลังจากนำโปรเจกต์ไปใช้งานในเครื่องใหม่หรือ server ให้สร้างไฟล์ `.env` จากตัวอย่าง:

```powershell
copy .env.example .env
```

จากนั้นใส่ค่าจริง:

```env
PORT=3300
HOST=127.0.0.1
TELEGRAM_BOT_TOKEN=token_จาก_BotFather
TELEGRAM_CHAT_ID=chat_id_ของผู้รับหรือกลุ่ม
```

แล้วเปิดระบบ:

```powershell
node server/server.js
```

## หมายเหตุด้านความปลอดภัย

- ห้าม commit ไฟล์ `.env`
- ห้ามใส่ Telegram token ลงในไฟล์ `.js`, `.html`, `.md` หรือ README
- ถ้าเคยส่ง token ในแชตหรือเผยแพร่ token แล้ว ควรสร้าง token ใหม่จาก BotFather
- เมื่อต่อ PostgreSQL/Neon ภายหลัง ให้เก็บ `DATABASE_URL` ใน `.env` หรือ GitHub Secrets เท่านั้น

# API Contract สำหรับเชื่อม Frontend กับ PostgreSQL/Neon และ Telegram

เอกสารนี้เป็นแบบร่าง endpoint สำหรับนำ frontend ไปเชื่อม backend/serverless API ภายหลัง

## Environment Variables

```text
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
ADMIN_JWT_SECRET=...
```

## Admin Login

`POST /api/admin/login`

Request:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:

```json
{
  "token": "jwt-token",
  "admin": {
    "username": "admin",
    "displayName": "System Administrator",
    "role": "admin"
  }
}
```

## Create Ticket

`POST /api/tickets`

Request:

```json
{
  "requesterName": "วชิรวิทย์ คงดี",
  "department": "บัญชี",
  "category": "อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง",
  "priority": "สูง",
  "title": "เครื่องพิมพ์แผนกบัญชีพิมพ์ไม่ออก",
  "description": "เครื่องพิมพ์ขึ้นสถานะ offline"
}
```

Response:

```json
{
  "ticketNo": "REQ-690001",
  "status": "รอรับเรื่อง"
}
```

หลังสร้าง ticket สำเร็จ backend ควรส่ง Telegram message ทันที

```text
มีใบแจ้งซ่อมใหม่
Ticket: REQ-690001
ผู้แจ้ง: วชิรวิทย์ คงดี
แผนก: บัญชี
ประเภท: อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง
ความเร่งด่วน: สูง
รายละเอียด: เครื่องพิมพ์ขึ้นสถานะ offline
```

## Track Ticket

`GET /api/tickets/:ticketNo`

Response:

```json
{
  "ticketNo": "REQ-690001",
  "requesterName": "วชิรวิทย์ คงดี",
  "department": "บัญชี",
  "category": "อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง",
  "priority": "สูง",
  "assignee": "ยังไม่มอบหมาย",
  "status": "รอรับเรื่อง",
  "solution": "",
  "createdAt": "2026-08-17T09:20:00+07:00",
  "updatedAt": "2026-08-17T09:20:00+07:00"
}
```

## Admin Dashboard

`GET /api/admin/dashboard?search=&department=&category=&priority=&status=`

Response:

```json
{
  "kpis": {
    "total": 2,
    "open": 2,
    "done": 0,
    "cancelled": 0
  },
  "charts": {
    "byCategory": [
      { "label": "อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วง", "value": 1 },
      { "label": "บัญชีผู้ใช้งานและสิทธิ์การเข้าถึง", "value": 1 }
    ],
    "byStatus": [
      { "label": "รอรับเรื่อง", "value": 1 },
      { "label": "กำลังดำเนินการ", "value": 1 }
    ]
  },
  "tickets": []
}
```

## Update Ticket Status

`PATCH /api/admin/tickets/:ticketNo/status`

Request:

```json
{
  "status": "กำลังดำเนินการ",
  "assignee": "ทีม IT Support",
  "solution": "ตรวจสอบและแก้ไขเรียบร้อย",
  "adminNote": "รับเรื่องแล้ว"
}
```

Response:

```json
{
  "ticketNo": "REQ-690001",
  "status": "กำลังดำเนินการ",
  "completedAt": null,
  "cancelledAt": null
}
```

หมายเหตุ: ถ้าเปลี่ยนสถานะเป็น `เสร็จสิ้น` ให้ backend บันทึกเวลาใน `completed_at`
ถ้าเปลี่ยนสถานะเป็น `ยกเลิก` ให้ backend บันทึกเวลาใน `cancelled_at`
สถานะ `รอรับเรื่อง` และ `กำลังดำเนินการ` ให้ล้างค่า 2 ช่องนี้เป็น `null`

# Banana Harvest Tracker v2 🍌

เวอร์ชันนี้แก้แนวคิดตามการใช้งานจริงมากขึ้น:

## สิ่งที่เปลี่ยน

### ตอนสร้างแปลง
กรอกเฉพาะข้อมูลที่รู้ได้ตั้งแต่แรก:
- ชื่อแปลง
- พันธุ์กล้วย
- จำนวนต้นทั้งหมด
- วันที่ปลูก
- หมายเหตุ

**ไม่ต้องกรอก**
- วันที่ออกเครือ
- จำนวนวันหลังออกเครือ

### เมื่อกล้วยออกเครือจริง
เข้าแปลงนั้นแล้วกด:

> + บันทึกการออกเครือ

แล้วกรอก:
- วันที่พบว่าออกเครือ
- จำนวนต้นที่ออกเครือในรุ่นนี้
- หมายเหตุ

ระบบจะ:
1. สร้าง "รุ่นการเก็บเกี่ยว"
2. ดึงจำนวนวันเริ่มต้นตามพันธุ์
3. คำนวณวันคาดว่าจะเก็บอัตโนมัติ
4. นับถอยหลัง
5. แสดงสถานะ

ตัวอย่าง:

```text
แปลง PL001 = 100 ต้น

รุ่น 1
ออกเครือ 10 มิ.ย.
20 ต้น

รุ่น 2
ออกเครือ 18 มิ.ย.
15 ต้น

ยังไม่ออกเครือ = 65 ต้น
```

---

# เปิดใน VS Code

1. แตก ZIP
2. เปิดโฟลเดอร์ `banana_harvest_system_v2`
3. เปิด `index.html`
4. ใช้ Live Server

บัญชีทดลอง:

```text
Admin
username: admin
password: 1234
```

```text
User
username: user
password: 1234
```

---

# โหมดทดลอง

ตอนแรกไฟล์:

`src/config.js`

ตั้งไว้:

```js
DEMO_MODE: true
```

ข้อมูลจึงเก็บใน Browser ก่อน

ถ้าจะล้างข้อมูลทดลอง:
> รีเซ็ตข้อมูลทดลอง

---

# ค่าเริ่มต้นจำนวนวันหลังออกเครือ

ใน `src/config.js` มี:

```js
VARIETY_HARVEST_DAYS
```

ตอนนี้ตั้งเป็น **ค่าตัวอย่าง 90 วัน** ทุกพันธุ์ เพื่อให้ระบบทดสอบได้

ก่อนใช้งานจริงควรกำหนดค่าที่เหมาะกับสวน/พันธุ์/วิธีปลูกของโครงการ

---

# Google Sheets v2

ระบบใหม่ใช้ 3 Sheet:

## Users

```text
User_ID
Username
PasswordHash
Name
Role
Status
```

## Plots

```text
Plot_ID
User_ID
Name
Variety
Tree_Count
Planted_Date
Note
Created_At
Updated_At
```

## Batches

```text
Batch_ID
Plot_ID
Batch_No
Bunch_Date
Tree_Count
Harvest_Days
Expected_Harvest_Date
Actual_Harvest_Date
Note
Created_At
Updated_At
```

---

# เชื่อม Google Sheets

1. สร้าง Google Sheet ใหม่
2. Extensions > Apps Script
3. เปิด `backend/Code.gs`
4. Copy ทั้งหมดไปใส่ Apps Script
5. เปลี่ยน

```js
const SPREADSHEET_ID = "PUT_YOUR_SPREADSHEET_ID_HERE";
```

เป็น ID ของ Google Sheet จริง

6. รัน:

```text
setupSheets
```

7. Deploy > New deployment > Web app
8. Execute as: Me
9. Who has access: Anyone
10. Copy URL ที่ลงท้าย `/exec`

จากนั้นเปิด:

`src/config.js`

ตั้ง:

```js
DEMO_MODE: false
```

และใส่:

```js
API_URL: "URL_ที่ได้จาก_Apps_Script"
```

---

# QR Code

QR ยังทำงานเหมือนเดิม แต่หน้าที่เปิดจาก QR ตอนนี้จะแสดง:

- ข้อมูลแปลง
- จำนวนต้นทั้งหมด
- จำนวนต้นที่ยังไม่ออกเครือ
- รายการรุ่นการเก็บเกี่ยว
- วันที่ออกเครือของแต่ละรุ่น
- วันคาดว่าจะเก็บ
- วันเก็บจริง
- สถานะ

ตอนทำงานใน VS Code QR จะเป็น `127.0.0.1`

หลังเอาเว็บขึ้นออนไลน์ ให้ใส่ URL จริงใน:

```js
PUBLIC_APP_URL
```

แล้วสร้าง QR จริงอีกครั้ง

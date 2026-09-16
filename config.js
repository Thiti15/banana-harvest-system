// ==============================
// Banana Harvest Tracker Config
// ==============================

export const CONFIG = {
  // true = ทดลองใน Browser ก่อน
  // false = ใช้ Google Sheets ผ่าน Google Apps Script
  DEMO_MODE: false,

  API_URL: "https://script.google.com/macros/s/AKfycbz6Rtvf5HKR9pkUhBROFaR-wLky0o46PrksqiS1kkMaWEwdIb33ndE4G_kVF-LzpLVI/exec",

  // ใส่ URL เว็บจริงหลังนำเว็บขึ้นออนไลน์
  // เช่น https://yourname.github.io/banana-harvest/
  PUBLIC_APP_URL: "https://thiti15.github.io/banana-harvest-system/",

  APP_NAME: "ระบบติดตามการเก็บเกี่ยวกล้วย",

  // ค่าเริ่มต้น "ตัวอย่าง" สำหรับการคำนวณอัตโนมัติหลังบันทึกว่าออกเครือ
  // ก่อนใช้งานจริงควรให้ผู้ดูแลโครงการ/ผู้เชี่ยวชาญกำหนดค่าที่เหมาะกับสวน
  VARIETY_HARVEST_DAYS: {
    "กล้วยน้ำว้า": 90,
    "กล้วยหอม": 90,
    "กล้วยไข่": 90,
    "กล้วยเล็บมือนาง": 90,
    "อื่น ๆ": 90,
  },
};

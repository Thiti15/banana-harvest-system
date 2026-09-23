// =========================================
// ตั้งค่าระบบติดตามการเก็บเกี่ยวกล้วย
// =========================================

export const CONFIG = {
  // false = ใช้งานจริงผ่าน Google Sheets
  DEMO_MODE: false,

  // Web app URL ของ Google Apps Script (ต้องลงท้าย /exec)
  API_URL: "https://script.google.com/macros/s/AKfycbz6Rtvf5HKR9pkUhBROFaR-wLky0o46PrksqiS1kkMaWEwdIb33ndE4G_kVF-LzpLVI/exec",

  // เว็บจริงสำหรับสร้าง QR Code ของแต่ละแปลง
  PUBLIC_APP_URL: "https://thiti15.github.io/banana-harvest-system/",

  // ใช้แสดงลิงก์ให้ Admin เปิดฐานข้อมูลได้
  SHEET_URL: "https://docs.google.com/spreadsheets/d/1GiyFVCNl1Iu-tIAg223xp-Yt5ix1RHaPBx3SdJw1vJg/edit",

  APP_NAME: "ระบบติดตามการเก็บเกี่ยวกล้วย",

  // จำนวนวันตัวอย่างหลังออกเครือก่อนคาดการณ์เก็บเกี่ยว
  VARIETY_HARVEST_DAYS: {
    "กล้วยน้ำว้า": 90,
    "กล้วยหอม": 90,
    "กล้วยไข่": 90,
    "กล้วยเล็บมือนาง": 90,
    "อื่น ๆ": 90,
  },
};

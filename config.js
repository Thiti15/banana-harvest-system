export const CONFIG = {
  // Google Apps Script Web App URL (ตัวที่ลงท้ายด้วย /exec)
  API_URL: "https://script.google.com/macros/s/AKfycbz6Rtvf5HKR9pkUhBROFaR-wLky0o46PrksqiS1kkMaWEwdlb33ndE4G_kVF-LzpLVI/exec",

  APP_NAME: "ระบบติดตามการเก็บเกี่ยวกล้วย",

  // จำนวนวันโดยประมาณหลังออกเครือก่อนเก็บเกี่ยว
  // ผู้ใช้ไม่ต้องกรอก ระบบคำนวณให้อัตโนมัติ
  VARIETY_HARVEST_DAYS: {
    "กล้วยน้ำว้า": 90,
    "กล้วยหอม": 90,
    "กล้วยไข่": 90,
    "กล้วยเล็บมือนาง": 90,
    "อื่น ๆ": 90,
  },
};

const STORAGE_KEY = "banana_harvest_demo_db_v2";

const seed = {
  users: [
    {
      id: "U001",
      username: "admin",
      password: "1234",
      name: "ผู้ดูแลระบบ",
      role: "admin",
      status: "active",
    },
    {
      id: "U002",
      username: "user",
      password: "1234",
      name: "ผู้ใช้งานตัวอย่าง",
      role: "user",
      status: "active",
    },
  ],

  // ข้อมูลแปลงเก็บเฉพาะข้อมูลที่รู้ได้ตั้งแต่วันสร้างแปลง
  plots: [
    {
      id: "PL001",
      userId: "U002",
      name: "แปลง A",
      variety: "กล้วยน้ำว้า",
      treeCount: 100,
      plantedDate: "2026-01-10",
      note: "ข้อมูลตัวอย่าง",
      createdAt: "2026-01-10T09:00:00",
      updatedAt: "2026-09-16T09:00:00",
    },
    {
      id: "PL002",
      userId: "U002",
      name: "แปลง B",
      variety: "กล้วยหอม",
      treeCount: 60,
      plantedDate: "2026-02-15",
      note: "",
      createdAt: "2026-02-15T09:00:00",
      updatedAt: "2026-09-16T09:00:00",
    },
  ],

  // เมื่อกล้วยออกเครือจริง ค่อยเพิ่มเป็น "รุ่นการเก็บเกี่ยว"
  batches: [
    {
      id: "BT001",
      plotId: "PL001",
      batchNo: 1,
      bunchDate: "2026-06-20",
      treeCount: 20,
      harvestDays: 90,
      expectedHarvestDate: "2026-09-18",
      actualHarvestDate: "",
      note: "รุ่นตัวอย่าง",
      createdAt: "2026-06-20T09:00:00",
      updatedAt: "2026-09-16T09:00:00",
    },
    {
      id: "BT002",
      plotId: "PL001",
      batchNo: 2,
      bunchDate: "2026-07-01",
      treeCount: 15,
      harvestDays: 90,
      expectedHarvestDate: "2026-09-29",
      actualHarvestDate: "",
      note: "",
      createdAt: "2026-07-01T09:00:00",
      updatedAt: "2026-09-16T09:00:00",
    },
  ],
};

export function loadDemoDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
  try {
    const db = JSON.parse(raw);
    if (!db.batches) db.batches = [];
    return db;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
}

export function saveDemoDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function resetDemoDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
}

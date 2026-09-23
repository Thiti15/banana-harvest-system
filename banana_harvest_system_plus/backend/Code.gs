/**
 * ระบบติดตามการเก็บเกี่ยวกล้วย v3
 * Google Sheets ภาษาไทยทั้งหมด
 *
 * ชื่อชีต:
 * - ผู้ใช้งาน
 * - แปลง
 * - รุ่นเก็บเกี่ยว
 *
 * หมายเหตุ:
 * หากมีชีตเดิม Users / Plots / Batches อยู่แล้ว
 * ให้รัน setupSheets() อีกครั้ง ระบบจะเปลี่ยนชื่อชีตและหัวตาราง
 * เป็นภาษาไทยโดยไม่ลบข้อมูลเดิม
 */

const SPREADSHEET_ID = "1GiyFVCNl1Iu-tIAg223xp-Yt5ix1RHaPBx3SdJw1vJg";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const VARIETY_HARVEST_DAYS = {
  "กล้วยน้ำว้า": 90,
  "กล้วยหอม": 90,
  "กล้วยไข่": 90,
  "กล้วยเล็บมือนาง": 90,
  "อื่น ๆ": 90
};

const SHEET_ALIASES = {
  "Users": "ผู้ใช้งาน",
  "Plots": "แปลง",
  "Batches": "รุ่นเก็บเกี่ยว"
};

const HEADER_KEY_MAP = {
  "รหัสผู้ใช้": "User_ID",
  "ชื่อผู้ใช้": "Username",
  "รหัสผ่านแฮช": "PasswordHash",
  "ชื่อ": "Name",
  "สิทธิ์": "Role",
  "สถานะ": "Status",

  "รหัสแปลง": "Plot_ID",
  "ชื่อแปลง": "Name",
  "พันธุ์กล้วย": "Variety",
  "จำนวนต้น": "Tree_Count",
  "วันที่ปลูก": "Planted_Date",

  "รหัสรุ่น": "Batch_ID",
  "รุ่นที่": "Batch_No",
  "วันที่ออกเครือ": "Bunch_Date",
  "จำนวนต้นที่ออกเครือ": "Tree_Count",
  "จำนวนวันหลังออกเครือ": "Harvest_Days",
  "วันที่คาดว่าจะเก็บเกี่ยว": "Expected_Harvest_Date",
  "วันที่เก็บเกี่ยวจริง": "Actual_Harvest_Date",

  "หมายเหตุ": "Note",
  "วันที่สร้าง": "Created_At",
  "วันที่แก้ไขล่าสุด": "Updated_At"
};

const HEADERS_USERS = [
  "รหัสผู้ใช้",
  "ชื่อผู้ใช้",
  "รหัสผ่านแฮช",
  "ชื่อ",
  "สิทธิ์",
  "สถานะ"
];

const HEADERS_PLOTS = [
  "รหัสแปลง",
  "รหัสผู้ใช้",
  "ชื่อแปลง",
  "พันธุ์กล้วย",
  "จำนวนต้น",
  "วันที่ปลูก",
  "หมายเหตุ",
  "วันที่สร้าง",
  "วันที่แก้ไขล่าสุด"
];

const HEADERS_BATCHES = [
  "รหัสรุ่น",
  "รหัสแปลง",
  "รุ่นที่",
  "วันที่ออกเครือ",
  "จำนวนต้นที่ออกเครือ",
  "จำนวนวันหลังออกเครือ",
  "วันที่คาดว่าจะเก็บเกี่ยว",
  "วันที่เก็บเกี่ยวจริง",
  "หมายเหตุ",
  "วันที่สร้าง",
  "วันที่แก้ไขล่าสุด"
];

function doGet(e) {
  return json_({ ok: true, message: "ระบบเก็บเกี่ยวกล้วยพร้อมใช้งาน" });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action || "";
    const token = body.token || "";
    const payload = body.payload || {};

    const publicActions = ["login", "getPlotPublic"];
    let auth = null;

    if (!publicActions.includes(action)) {
      auth = requireAuth_(token);
    }

    let data;

    switch (action) {
      case "login":
        data = login_(payload);
        break;
      case "getUsers":
        requireAdmin_(auth);
        data = getUsers_();
        break;
      case "saveUser":
        requireAdmin_(auth);
        data = saveUser_(payload);
        break;
      case "getPlots":
        data = getPlots_(auth);
        break;
      case "getBatches":
        data = getBatches_(auth);
        break;
      case "getPlotPublic":
        data = getPlotPublic_(payload.plotId);
        break;
      case "savePlot":
        data = savePlot_(auth, payload);
        break;
      case "deletePlot":
        requireAdmin_(auth);
        data = deletePlot_(payload.plotId);
        break;
      case "saveBatch":
        data = saveBatch_(auth, payload);
        break;
      case "markBatchHarvested":
        data = markBatchHarvested_(auth, payload.batchId, payload.date);
        break;
      default:
        throw new Error("ไม่พบคำสั่งที่ต้องการ");
    }

    return json_({ ok: true, data });
  } catch (err) {
    return json_({ ok: false, message: err.message });
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const users = ensureThaiSheet_(ss, "Users", "ผู้ใช้งาน", HEADERS_USERS);
  ensureThaiSheet_(ss, "Plots", "แปลง", HEADERS_PLOTS);
  ensureThaiSheet_(ss, "Batches", "รุ่นเก็บเกี่ยว", HEADERS_BATCHES);

  if (users.getLastRow() === 1) {
    users.appendRow([
      "U001",
      "admin",
      sha256_("1234"),
      "ผู้ดูแลระบบ",
      "ผู้ดูแลระบบ",
      "ใช้งาน"
    ]);

    users.appendRow([
      "U002",
      "user",
      sha256_("1234"),
      "ผู้ใช้งานตัวอย่าง",
      "ผู้ใช้งาน",
      "ใช้งาน"
    ]);
  }

  // แปลงค่าบทบาท/สถานะเดิมให้เป็นภาษาไทย
  if (users.getLastRow() >= 2) {
    for (let row = 2; row <= users.getLastRow(); row++) {
      const role = String(users.getRange(row, 5).getValue());
      const status = String(users.getRange(row, 6).getValue());

      users.getRange(row, 5).setValue(roleToSheet_(roleToApi_(role)));
      users.getRange(row, 6).setValue(statusToSheet_(statusToApi_(status)));
    }
  }

  ["ผู้ใช้งาน", "แปลง", "รุ่นเก็บเกี่ยว"].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) {
      sh.setFrozenRows(1);
      if (sh.getLastColumn() > 0) {
        sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight("bold");
        sh.autoResizeColumns(1, sh.getLastColumn());
      }
    }
  });
}

function ensureThaiSheet_(ss, oldName, newName, headers) {
  let sh = ss.getSheetByName(newName);

  if (!sh) {
    const old = ss.getSheetByName(oldName);

    if (old) {
      old.setName(newName);
      sh = old;
    } else {
      sh = ss.insertSheet(newName);
    }
  }

  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sh;
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function sh_(name) {
  const actualName = SHEET_ALIASES[name] || name;
  const sh = ss_().getSheetByName(actualName);

  if (!sh) {
    throw new Error("ไม่พบชีต " + actualName + " กรุณารัน setupSheets() ก่อน");
  }

  return sh;
}

function rows_(sheetName) {
  const sh = sh_(sheetName);

  if (!sh || sh.getLastRow() < 2) {
    return [];
  }

  const values = sh.getDataRange().getValues();
  const visibleHeaders = values.shift();

  const keys = visibleHeaders.map(h => {
    const header = String(h);
    return HEADER_KEY_MAP[header] || header;
  });

  return values.map(r =>
    Object.fromEntries(keys.map((key, i) => [key, r[i]]))
  );
}

function roleToApi_(role) {
  return String(role) === "ผู้ดูแลระบบ" || String(role) === "admin"
    ? "admin"
    : "user";
}

function roleToSheet_(role) {
  return role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน";
}

function statusToApi_(status) {
  return String(status) === "ใช้งาน" || String(status) === "active"
    ? "active"
    : "inactive";
}

function statusToSheet_(status) {
  return status === "active" ? "ใช้งาน" : "ปิดใช้งาน";
}

function login_(p) {
  const user = rows_("Users").find(
    u =>
      String(u.Username) === String(p.username) &&
      String(u.PasswordHash) === sha256_(String(p.password)) &&
      statusToApi_(u.Status) === "active"
  );

  if (!user) {
    throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  }

  const token = Utilities.getUuid();

  const safe = {
    id: String(user.User_ID),
    username: String(user.Username),
    name: String(user.Name),
    role: roleToApi_(user.Role)
  };

  CacheService.getScriptCache().put(
    "session:" + token,
    JSON.stringify(safe),
    SESSION_TTL_SECONDS
  );

  return { token, user: safe };
}

function requireAuth_(token) {
  const raw = CacheService.getScriptCache().get("session:" + token);

  if (!raw) {
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  return JSON.parse(raw);
}

function requireAdmin_(auth) {
  if (!auth || auth.role !== "admin") {
    throw new Error("ไม่มีสิทธิ์สำหรับรายการนี้");
  }
}

function getUsers_() {
  return rows_("Users").map(u => ({
    id: String(u.User_ID),
    username: String(u.Username),
    name: String(u.Name),
    role: roleToApi_(u.Role),
    status: statusToApi_(u.Status)
  }));
}

function saveUser_(p) {
  const sh = sh_("Users");
  const rows = rows_("Users");

  if (p.id) {
    const idx = rows.findIndex(
      x => String(x.User_ID) === String(p.id)
    );

    if (idx < 0) {
      throw new Error("ไม่พบผู้ใช้งาน");
    }

    const row = idx + 2;

    sh.getRange(row, 2).setValue(p.username);

    if (p.password) {
      sh.getRange(row, 3).setValue(sha256_(p.password));
    }

    sh.getRange(row, 4).setValue(p.name);
    sh.getRange(row, 5).setValue(roleToSheet_(p.role));
    sh.getRange(row, 6).setValue(statusToSheet_(p.status));

    return p;
  }

  const id = nextId_("Users", "User_ID", "U", 3);

  sh.appendRow([
    id,
    p.username,
    sha256_(p.password),
    p.name,
    roleToSheet_(p.role || "user"),
    statusToSheet_(p.status || "active")
  ]);

  return Object.assign({}, p, { id });
}

function getPlots_(auth) {
  const allPlots = rows_("Plots").map(plotFromRow_);
  const allBatches = rows_("Batches").map(batchFromRow_);

  const allowed =
    auth.role === "admin"
      ? allPlots
      : allPlots.filter(p => p.userId === auth.id);

  return allowed.map(p => {
    const related = allBatches.filter(b => b.plotId === p.id);

    return Object.assign({}, p, {
      status: plotStatus_(p, related),
      remainingUnbunched: remainingUnbunched_(p, related)
    });
  });
}

function getBatches_(auth) {
  const plots = getPlots_(auth);
  const allowedIds = {};

  plots.forEach(p => {
    allowedIds[p.id] = true;
  });

  return rows_("Batches")
    .map(batchFromRow_)
    .filter(b => allowedIds[b.plotId]);
}

function getPlotPublic_(plotId) {
  const plotRow = rows_("Plots").find(
    x => String(x.Plot_ID) === String(plotId)
  );

  if (!plotRow) {
    throw new Error("ไม่พบข้อมูลแปลง");
  }

  const plot = plotFromRow_(plotRow);

  const batches = rows_("Batches")
    .map(batchFromRow_)
    .filter(b => b.plotId === plot.id);

  return {
    plot: Object.assign({}, plot, {
      status: plotStatus_(plot, batches),
      remainingUnbunched: remainingUnbunched_(plot, batches)
    }),
    batches
  };
}

function savePlot_(auth, p) {
  const sh = sh_("Plots");
  const rows = rows_("Plots");
  const now = new Date();

  if (p.id) {
    const idx = rows.findIndex(
      x => String(x.Plot_ID) === String(p.id)
    );

    if (idx < 0) {
      throw new Error("ไม่พบแปลง");
    }

    const current = plotFromRow_(rows[idx]);

    if (auth.role !== "admin" && current.userId !== auth.id) {
      throw new Error("ไม่มีสิทธิ์แก้ไขแปลงนี้");
    }

    const owner =
      auth.role === "admin"
        ? String(p.userId || current.userId)
        : auth.id;

    const row = idx + 2;

    sh.getRange(row, 2, 1, 8).setValues([[
      owner,
      p.name,
      p.variety,
      Number(p.treeCount || 0),
      toDate_(p.plantedDate),
      p.note || "",
      current.createdAt || now,
      now
    ]]);

    return getPlotPublic_(p.id).plot;
  }

  const id = nextId_("Plots", "Plot_ID", "PL", 3);

  const owner =
    auth.role === "admin"
      ? String(p.userId || auth.id)
      : auth.id;

  sh.appendRow([
    id,
    owner,
    p.name,
    p.variety,
    Number(p.treeCount || 0),
    toDate_(p.plantedDate),
    p.note || "",
    now,
    now
  ]);

  return getPlotPublic_(id).plot;
}

function deletePlot_(plotId) {
  const plotSh = sh_("Plots");
  const plotRows = rows_("Plots");

  const idx = plotRows.findIndex(
    x => String(x.Plot_ID) === String(plotId)
  );

  if (idx < 0) {
    throw new Error("ไม่พบแปลง");
  }

  plotSh.deleteRow(idx + 2);

  const batchSh = sh_("Batches");
  const batchRows = rows_("Batches");

  for (let i = batchRows.length - 1; i >= 0; i--) {
    if (String(batchRows[i].Plot_ID) === String(plotId)) {
      batchSh.deleteRow(i + 2);
    }
  }

  return true;
}

function saveBatch_(auth, p) {
  const plotRow = rows_("Plots").find(
    x => String(x.Plot_ID) === String(p.plotId)
  );

  if (!plotRow) {
    throw new Error("ไม่พบแปลง");
  }

  const plot = plotFromRow_(plotRow);

  if (auth.role !== "admin" && plot.userId !== auth.id) {
    throw new Error("ไม่มีสิทธิ์เพิ่มรุ่นให้แปลงนี้");
  }

  const batchSh = sh_("Batches");
  const batchRows = rows_("Batches");
  const allBatches = batchRows.map(batchFromRow_);

  const otherBatches = allBatches.filter(
    b => b.plotId === plot.id && b.id !== String(p.id || "")
  );

  const used = otherBatches.reduce(
    (sum, b) => sum + Number(b.treeCount || 0),
    0
  );

  const nextCount = Number(p.treeCount || 0);

  if (used + nextCount > Number(plot.treeCount || 0)) {
    throw new Error(
      "จำนวนต้นรวมเกินจำนวนต้นในแปลง เหลือบันทึกได้ " +
        (Number(plot.treeCount || 0) - used) +
        " ต้น"
    );
  }

  const harvestDays =
    VARIETY_HARVEST_DAYS[plot.variety] ||
    VARIETY_HARVEST_DAYS["อื่น ๆ"] ||
    90;

  const expected = addDays_(p.bunchDate, harvestDays);
  const now = new Date();

  if (p.id) {
    const idx = batchRows.findIndex(
      x => String(x.Batch_ID) === String(p.id)
    );

    if (idx < 0) {
      throw new Error("ไม่พบรุ่นการเก็บเกี่ยว");
    }

    const current = batchFromRow_(batchRows[idx]);
    const row = idx + 2;

    batchSh.getRange(row, 2, 1, 10).setValues([[
      plot.id,
      current.batchNo,
      toDate_(p.bunchDate),
      nextCount,
      harvestDays,
      toDate_(expected),
      toDate_(current.actualHarvestDate),
      p.note || "",
      current.createdAt || now,
      now
    ]]);

    return batchFromRow_(rows_("Batches")[idx]);
  }

  const id = nextId_("Batches", "Batch_ID", "BT", 3);

  const plotBatchNumbers = allBatches
    .filter(b => b.plotId === plot.id)
    .map(b => Number(b.batchNo || 0));

  const batchNo =
    (plotBatchNumbers.length
      ? Math.max.apply(null, plotBatchNumbers)
      : 0) + 1;

  batchSh.appendRow([
    id,
    plot.id,
    batchNo,
    toDate_(p.bunchDate),
    nextCount,
    harvestDays,
    toDate_(expected),
    "",
    p.note || "",
    now,
    now
  ]);

  return batchFromRow_(
    rows_("Batches").find(
      x => String(x.Batch_ID) === String(id)
    )
  );
}

function markBatchHarvested_(auth, batchId, date) {
  const batchSh = sh_("Batches");
  const batchRows = rows_("Batches");

  const idx = batchRows.findIndex(
    x => String(x.Batch_ID) === String(batchId)
  );

  if (idx < 0) {
    throw new Error("ไม่พบรุ่นการเก็บเกี่ยว");
  }

  const batch = batchFromRow_(batchRows[idx]);

  const plotRow = rows_("Plots").find(
    x => String(x.Plot_ID) === String(batch.plotId)
  );

  if (!plotRow) {
    throw new Error("ไม่พบแปลง");
  }

  const plot = plotFromRow_(plotRow);

  if (auth.role !== "admin" && plot.userId !== auth.id) {
    throw new Error("ไม่มีสิทธิ์แก้ไขรุ่นนี้");
  }

  const row = idx + 2;

  batchSh.getRange(row, 8).setValue(toDate_(date));
  batchSh.getRange(row, 11).setValue(new Date());

  return batchFromRow_(rows_("Batches")[idx]);
}

function plotFromRow_(r) {
  return {
    id: String(r.Plot_ID),
    userId: String(r.User_ID),
    name: String(r.Name || ""),
    variety: String(r.Variety || ""),
    treeCount: Number(r.Tree_Count || 0),
    plantedDate: dateStr_(r.Planted_Date),
    note: String(r.Note || ""),
    createdAt: dateStrTime_(r.Created_At),
    updatedAt: dateStrTime_(r.Updated_At)
  };
}

function batchFromRow_(r) {
  const b = {
    id: String(r.Batch_ID),
    plotId: String(r.Plot_ID),
    batchNo: Number(r.Batch_No || 0),
    bunchDate: dateStr_(r.Bunch_Date),
    treeCount: Number(r.Tree_Count || 0),
    harvestDays: Number(r.Harvest_Days || 0),
    expectedHarvestDate: dateStr_(r.Expected_Harvest_Date),
    actualHarvestDate: dateStr_(r.Actual_Harvest_Date),
    note: String(r.Note || ""),
    createdAt: dateStrTime_(r.Created_At),
    updatedAt: dateStrTime_(r.Updated_At)
  };

  b.status = batchStatus_(b);
  return b;
}

function remainingUnbunched_(plot, batches) {
  const used = batches.reduce(
    (sum, b) => sum + Number(b.treeCount || 0),
    0
  );

  return Math.max(0, Number(plot.treeCount || 0) - used);
}

function plotStatus_(plot, batches) {
  if (!batches.length) {
    return "ยังไม่ออกเครือ";
  }

  const statuses = batches.map(b => batchStatus_(b));

  if (statuses.indexOf("เกินกำหนด") >= 0) {
    return "เกินกำหนด";
  }

  if (statuses.indexOf("ถึงกำหนดเก็บเกี่ยว") >= 0) {
    return "ถึงกำหนดเก็บเกี่ยว";
  }

  if (statuses.indexOf("ใกล้เก็บเกี่ยว") >= 0) {
    return "ใกล้เก็บเกี่ยว";
  }

  if (statuses.indexOf("รอเก็บเกี่ยว") >= 0) {
    return "รอเก็บเกี่ยว";
  }

  const allDone = statuses.every(
    s => s === "เก็บเกี่ยวแล้ว"
  );

  const remaining = remainingUnbunched_(plot, batches);

  if (allDone && remaining === 0) {
    return "เก็บเกี่ยวแล้ว";
  }

  if (allDone && remaining > 0) {
    return "ยังมีต้นที่ยังไม่ออกเครือ";
  }

  return "รอข้อมูล";
}

function batchStatus_(batch) {
  if (batch.actualHarvestDate) {
    return "เก็บเกี่ยวแล้ว";
  }

  if (!batch.expectedHarvestDate) {
    return "รอข้อมูล";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = toDate_(batch.expectedHarvestDate);
  target.setHours(0, 0, 0, 0);

  const d = Math.ceil(
    (target - today) / 86400000
  );

  if (d < 0) return "เกินกำหนด";
  if (d === 0) return "ถึงกำหนดเก็บเกี่ยว";
  if (d <= 14) return "ใกล้เก็บเกี่ยว";

  return "รอเก็บเกี่ยว";
}

function addDays_(s, n) {
  const d = toDate_(s);
  d.setDate(d.getDate() + Number(n));
  return dateStr_(d);
}

function toDate_(v) {
  if (!v) return "";

  if (
    Object.prototype.toString.call(v) === "[object Date]"
  ) {
    return v;
  }

  const d = new Date(
    String(v).slice(0, 10) + "T00:00:00"
  );

  return isNaN(d) ? "" : d;
}

function dateStr_(v) {
  if (!v) return "";

  const d = toDate_(v);
  if (!d) return "";

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone() || "Asia/Bangkok",
    "yyyy-MM-dd"
  );
}

function dateStrTime_(v) {
  if (!v) return "";

  const d = v instanceof Date ? v : new Date(v);

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone() || "Asia/Bangkok",
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}

function nextId_(sheetName, key, prefix, digits) {
  const nums = rows_(sheetName)
    .map(r =>
      Number(
        String(r[key] || "").replace(/\D/g, "")
      )
    )
    .filter(n => !isNaN(n));

  return (
    prefix +
    String(
      (nums.length ? Math.max.apply(null, nums) : 0) + 1
    ).padStart(digits, "0")
  );
}

function sha256_(s) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    s,
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(b =>
      (
        "0" +
        ((b < 0 ? b + 256 : b).toString(16))
      ).slice(-2)
    )
    .join("");
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

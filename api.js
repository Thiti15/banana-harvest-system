import { CONFIG } from "./config.js";
import { loadDemoDB, saveDemoDB } from "./data.js";

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(dateStr, days) {
  if (!dateStr || !days) return "";
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function batchStatus(batch) {
  if (batch.actualHarvestDate) return "เก็บเกี่ยวแล้ว";
  if (!batch.expectedHarvestDate) return "รอข้อมูล";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(batch.expectedHarvestDate + "T00:00:00");
  const d = Math.ceil((target - today) / 86400000);
  if (d < 0) return "เกินกำหนด";
  if (d === 0) return "ถึงกำหนดเก็บเกี่ยว";
  if (d <= 14) return "ใกล้เก็บเกี่ยว";
  return "รอเก็บเกี่ยว";
}

function remainingUnbunched(plot, batches) {
  const assigned = batches
    .filter((b) => b.plotId === plot.id)
    .reduce((sum, b) => sum + Number(b.treeCount || 0), 0);
  return Math.max(0, Number(plot.treeCount || 0) - assigned);
}

function plotStatus(plot, batches) {
  const related = batches.filter((b) => b.plotId === plot.id);
  const remaining = remainingUnbunched(plot, batches);

  if (!related.length) return "ยังไม่ออกเครือ";

  const statuses = related.map(batchStatus);
  if (statuses.includes("เกินกำหนด")) return "เกินกำหนด";
  if (statuses.includes("ถึงกำหนดเก็บเกี่ยว")) return "ถึงกำหนดเก็บเกี่ยว";
  if (statuses.includes("ใกล้เก็บเกี่ยว")) return "ใกล้เก็บเกี่ยว";
  if (statuses.includes("รอเก็บเกี่ยว")) return "รอเก็บเกี่ยว";

  const allDone = statuses.every((s) => s === "เก็บเกี่ยวแล้ว");
  if (allDone && remaining === 0) return "เก็บเกี่ยวแล้ว";
  if (allDone && remaining > 0) return "ยังมีต้นที่ยังไม่ออกเครือ";
  return "รอข้อมูล";
}

async function remote(action, payload = {}, token = "") {
  if (!CONFIG.API_URL) {
    throw new Error("ยังไม่ได้ตั้งค่า API_URL ใน src/config.js");
  }
  const res = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token, payload }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || "เกิดข้อผิดพลาด");
  return data.data;
}

export const api = {
  async login(username, password) {
    if (!CONFIG.DEMO_MODE) return remote("login", { username, password });

    await wait();
    const db = loadDemoDB();
    const user = db.users.find(
      (u) =>
        u.username === username &&
        u.password === password &&
        u.status === "active"
    );
    if (!user) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

    return {
      token: "demo-" + user.id,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  },

  async getUsers(token) {
    if (!CONFIG.DEMO_MODE) return remote("getUsers", {}, token);

    await wait();
    const db = loadDemoDB();
    return db.users.map(({ password, ...u }) => u);
  },

  async saveUser(token, user) {
    if (!CONFIG.DEMO_MODE) return remote("saveUser", user, token);

    await wait();
    const db = loadDemoDB();

    if (user.id) {
      const idx = db.users.findIndex((u) => u.id === user.id);
      if (idx < 0) throw new Error("ไม่พบผู้ใช้งาน");
      const old = db.users[idx];
      db.users[idx] = {
        ...old,
        ...user,
        password: user.password || old.password,
      };
    } else {
      const nums = db.users
        .map((u) => Number(String(u.id).replace(/\D/g, "")))
        .filter(Number.isFinite);
      user.id = "U" + String(Math.max(0, ...nums) + 1).padStart(3, "0");
      db.users.push({
        status: "active",
        role: "user",
        ...user,
      });
    }

    saveDemoDB(db);
    return user;
  },

  async getPlots(token, viewer) {
    if (!CONFIG.DEMO_MODE) return remote("getPlots", {}, token);

    await wait();
    const db = loadDemoDB();
    let plots = db.plots;

    if (viewer.role !== "admin") {
      plots = plots.filter((p) => p.userId === viewer.id);
    }

    return plots.map((p) => ({
      ...p,
      status: plotStatus(p, db.batches),
      remainingUnbunched: remainingUnbunched(p, db.batches),
    }));
  },

  async getBatches(token, viewer) {
    if (!CONFIG.DEMO_MODE) return remote("getBatches", {}, token);

    await wait();
    const db = loadDemoDB();
    const allowedPlotIds =
      viewer.role === "admin"
        ? new Set(db.plots.map((p) => p.id))
        : new Set(
            db.plots
              .filter((p) => p.userId === viewer.id)
              .map((p) => p.id)
          );

    return db.batches
      .filter((b) => allowedPlotIds.has(b.plotId))
      .map((b) => ({ ...b, status: batchStatus(b) }));
  },

  async getPlotPublic(plotId) {
    if (!CONFIG.DEMO_MODE) return remote("getPlotPublic", { plotId });

    await wait();
    const db = loadDemoDB();
    const plot = db.plots.find((p) => p.id === plotId);
    if (!plot) throw new Error("ไม่พบข้อมูลแปลง");

    const batches = db.batches
      .filter((b) => b.plotId === plotId)
      .map((b) => ({ ...b, status: batchStatus(b) }));

    return {
      plot: {
        ...plot,
        status: plotStatus(plot, db.batches),
        remainingUnbunched: remainingUnbunched(plot, db.batches),
      },
      batches,
    };
  },

  async savePlot(token, plot, viewer) {
    if (!CONFIG.DEMO_MODE) return remote("savePlot", plot, token);

    await wait();
    const db = loadDemoDB();
    const now = new Date().toISOString();

    if (plot.id) {
      const idx = db.plots.findIndex((p) => p.id === plot.id);
      if (idx < 0) throw new Error("ไม่พบแปลง");

      const old = db.plots[idx];
      if (viewer.role !== "admin" && old.userId !== viewer.id) {
        throw new Error("ไม่มีสิทธิ์แก้ไขแปลงนี้");
      }

      db.plots[idx] = {
        ...old,
        ...plot,
        userId:
          viewer.role === "admin"
            ? plot.userId || old.userId
            : viewer.id,
        updatedAt: now,
      };
    } else {
      const nums = db.plots
        .map((p) => Number(String(p.id).replace(/\D/g, "")))
        .filter(Number.isFinite);

      plot.id =
        "PL" + String(Math.max(0, ...nums) + 1).padStart(3, "0");
      plot.userId =
        viewer.role === "admin"
          ? plot.userId || viewer.id
          : viewer.id;

      db.plots.push({
        ...plot,
        createdAt: now,
        updatedAt: now,
      });
    }

    saveDemoDB(db);
    return plot;
  },

  async deletePlot(token, plotId) {
    if (!CONFIG.DEMO_MODE) return remote("deletePlot", { plotId }, token);

    await wait();
    const db = loadDemoDB();
    db.plots = db.plots.filter((p) => p.id !== plotId);
    db.batches = db.batches.filter((b) => b.plotId !== plotId);
    saveDemoDB(db);
    return true;
  },

  async saveBatch(token, batch, viewer) {
    if (!CONFIG.DEMO_MODE) return remote("saveBatch", batch, token);

    await wait();
    const db = loadDemoDB();
    const plot = db.plots.find((p) => p.id === batch.plotId);
    if (!plot) throw new Error("ไม่พบแปลง");

    if (viewer.role !== "admin" && plot.userId !== viewer.id) {
      throw new Error("ไม่มีสิทธิ์เพิ่มรุ่นให้แปลงนี้");
    }

    const existing = db.batches.filter(
      (b) => b.plotId === plot.id && b.id !== batch.id
    );
    const assigned = existing.reduce(
      (sum, b) => sum + Number(b.treeCount || 0),
      0
    );
    const nextCount = Number(batch.treeCount || 0);

    if (assigned + nextCount > Number(plot.treeCount || 0)) {
      throw new Error(
        `จำนวนต้นรวมเกินจำนวนต้นในแปลง (เหลือบันทึกได้ ${
          Number(plot.treeCount || 0) - assigned
        } ต้น)`
      );
    }

    const harvestDays =
      CONFIG.VARIETY_HARVEST_DAYS[plot.variety] ||
      CONFIG.VARIETY_HARVEST_DAYS["อื่น ๆ"] ||
      90;

    batch.harvestDays = harvestDays;
    batch.expectedHarvestDate = addDays(batch.bunchDate, harvestDays);

    const now = new Date().toISOString();

    if (batch.id) {
      const idx = db.batches.findIndex((b) => b.id === batch.id);
      if (idx < 0) throw new Error("ไม่พบรุ่นการเก็บเกี่ยว");
      db.batches[idx] = {
        ...db.batches[idx],
        ...batch,
        updatedAt: now,
      };
    } else {
      const nums = db.batches
        .map((b) => Number(String(b.id).replace(/\D/g, "")))
        .filter(Number.isFinite);

      const plotBatchNums = db.batches
        .filter((b) => b.plotId === plot.id)
        .map((b) => Number(b.batchNo || 0));

      batch.id =
        "BT" + String(Math.max(0, ...nums) + 1).padStart(3, "0");
      batch.batchNo = Math.max(0, ...plotBatchNums) + 1;

      db.batches.push({
        ...batch,
        actualHarvestDate: "",
        createdAt: now,
        updatedAt: now,
      });
    }

    saveDemoDB(db);
    return batch;
  },

  async markBatchHarvested(token, batchId, date, viewer) {
    if (!CONFIG.DEMO_MODE) {
      return remote("markBatchHarvested", { batchId, date }, token);
    }

    await wait();
    const db = loadDemoDB();
    const idx = db.batches.findIndex((b) => b.id === batchId);
    if (idx < 0) throw new Error("ไม่พบรุ่นการเก็บเกี่ยว");

    const batch = db.batches[idx];
    const plot = db.plots.find((p) => p.id === batch.plotId);

    if (
      viewer.role !== "admin" &&
      (!plot || plot.userId !== viewer.id)
    ) {
      throw new Error("ไม่มีสิทธิ์แก้ไขรุ่นนี้");
    }

    db.batches[idx] = {
      ...batch,
      actualHarvestDate: date,
      updatedAt: new Date().toISOString(),
    };

    saveDemoDB(db);
    return db.batches[idx];
  },
};

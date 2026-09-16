import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { resetDemoDB } from "./data.js";

const app = document.getElementById("app");

const state = {
  session: JSON.parse(sessionStorage.getItem("banana_session") || "null"),
  plots: [],
  batches: [],
  users: [],
  currentView: "dashboard",
  publicData: null,
};

const fmt = (date) => {
  if (!date) return "-";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const daysLeft = (date) => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + "T00:00:00");
  return Math.ceil((target - today) / 86400000);
};

const statusClass = (s = "") => {
  if (s.includes("เก็บเกี่ยวแล้ว")) return "ok";
  if (s.includes("ถึงกำหนด") || s.includes("เกินกำหนด")) return "danger";
  if (s.includes("ใกล้")) return "warn";
  if (s.includes("ยังไม่")) return "muted";
  return "info";
};

function setSession(session) {
  state.session = session;
  if (session) {
    sessionStorage.setItem("banana_session", JSON.stringify(session));
  } else {
    sessionStorage.removeItem("banana_session");
  }
}

function routeFromUrl() {
  const q = new URLSearchParams(location.search);
  const plotId = q.get("plot");
  return plotId ? { type: "public", plotId } : { type: "app" };
}

async function boot() {
  const route = routeFromUrl();

  if (route.type === "public") {
    try {
      state.publicData = await api.getPlotPublic(route.plotId);
      renderPublicPlot();
    } catch (e) {
      app.innerHTML = errorPage(e.message);
    }
    return;
  }

  if (!state.session) {
    renderLogin();
    return;
  }

  await refreshData();
  render();
}

async function refreshData() {
  const { token, user } = state.session;
  state.plots = await api.getPlots(token, user);
  state.batches = await api.getBatches(token, user);

  if (user.role === "admin") {
    state.users = await api.getUsers(token);
  }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-card">
        <div class="brand-mark">🍌</div>
        <h1>${CONFIG.APP_NAME}</h1>
        <p class="muted-text">เข้าสู่ระบบเพื่อจัดการข้อมูลแปลงและวันเก็บเกี่ยว</p>

        <form id="loginForm" class="form-grid single">
          <label>
            ชื่อผู้ใช้
            <input name="username" required placeholder="admin หรือ user">
          </label>

          <label>
            รหัสผ่าน
            <input name="password" type="password" required placeholder="1234">
          </label>

          <button class="btn primary" type="submit">เข้าสู่ระบบ</button>
        </form>

        <div class="demo-box">
          <strong>โหมดทดลอง:</strong> admin / 1234 &nbsp; หรือ &nbsp; user / 1234
        </div>

        <p id="loginError" class="error-text"></p>
      </section>
    </main>
  `;

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    try {
      const result = await api.login(
        fd.get("username"),
        fd.get("password")
      );
      setSession(result);
      await refreshData();
      render();
    } catch (err) {
      document.getElementById("loginError").textContent = err.message;
    }
  });
}

function layout(content) {
  const u = state.session.user;

  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span>🍌</span>
          <div>
            <b>Banana Harvest</b>
            <small>Tracker</small>
          </div>
        </div>

        <div class="user-chip">
          <div class="avatar">${escapeHtml(u.name.slice(0, 1))}</div>
          <div>
            <b>${escapeHtml(u.name)}</b>
            <small>${u.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}</small>
          </div>
        </div>

        <nav>
          ${navBtn("dashboard", "ภาพรวม", "🏠")}
          ${navBtn("plots", "จัดการแปลง", "🍌")}
          ${navBtn("history", "ประวัติการเก็บเกี่ยว", "📜")}
          ${
            u.role === "admin"
              ? navBtn("users", "จัดการผู้ใช้งาน", "👥")
              : ""
          }
        </nav>

        <div class="side-bottom">
          ${
            CONFIG.DEMO_MODE
              ? `<button id="resetDemo" class="btn ghost full">รีเซ็ตข้อมูลทดลอง</button>`
              : ""
          }
          <button id="logoutBtn" class="btn ghost full">ออกจากระบบ</button>
        </div>
      </aside>

      <section class="main">
        <header class="topbar">
          <div>
            <h2>${viewTitle()}</h2>
            <p>${new Date().toLocaleDateString("th-TH", {
              dateStyle: "full",
            })}</p>
          </div>

          <button class="btn primary" id="quickAdd">+ เพิ่มแปลง</button>
        </header>

        <div class="content">${content}</div>
      </section>
    </div>
  `;
}

function navBtn(view, label, icon) {
  return `
    <button class="nav-btn ${
      state.currentView === view ? "active" : ""
    }" data-view="${view}">
      <span>${icon}</span>${label}
    </button>
  `;
}

function viewTitle() {
  return (
    {
      dashboard: "ภาพรวมการเก็บเกี่ยว",
      plots: "จัดการแปลง",
      history: "ประวัติการเก็บเกี่ยว",
      users: "จัดการผู้ใช้งาน",
    }[state.currentView] || "ระบบ"
  );
}

function render() {
  let content = "";

  if (state.currentView === "dashboard") content = dashboardView();
  if (state.currentView === "plots") content = plotsView();
  if (state.currentView === "history") content = historyView();
  if (state.currentView === "users") content = usersView();

  app.innerHTML = layout(content);
  bindCommon();
  bindView();
}

function dashboardView() {
  const totalPlots = state.plots.length;
  const near = state.batches.filter((b) => b.status === "ใกล้เก็บเกี่ยว").length;
  const due = state.batches.filter((b) =>
    ["ถึงกำหนดเก็บเกี่ยว", "เกินกำหนด"].includes(b.status)
  ).length;
  const done = state.batches.filter((b) => b.status === "เก็บเกี่ยวแล้ว").length;

  const upcoming = state.batches
    .filter((b) => !b.actualHarvestDate && b.expectedHarvestDate)
    .sort((a, b) =>
      a.expectedHarvestDate.localeCompare(b.expectedHarvestDate)
    )
    .slice(0, 8);

  return `
    <div class="cards">
      ${statCard("แปลงทั้งหมด", totalPlots, "🍌")}
      ${statCard("รุ่นใกล้เก็บ", near, "🟠")}
      ${statCard("รุ่นถึง/เกินกำหนด", due, "🔴")}
      ${statCard("รุ่นเก็บแล้ว", done, "✅")}
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>รายการใกล้ถึงกำหนด</h3>
          <p>แสดงเป็นรุ่นการเก็บเกี่ยวของแต่ละแปลง</p>
        </div>
      </div>

      ${
        upcoming.length
          ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>แปลง</th>
                <th>รุ่น</th>
                <th>จำนวนต้น</th>
                <th>วันที่ออกเครือ</th>
                <th>คาดว่าเก็บ</th>
                <th>เหลือ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${upcoming
                .map((b) => {
                  const p = state.plots.find((x) => x.id === b.plotId);
                  return `
                    <tr>
                      <td><b>${b.plotId}</b> ${escapeHtml(p?.name || "")}</td>
                      <td>รุ่น ${b.batchNo}</td>
                      <td>${b.treeCount} ต้น</td>
                      <td>${fmt(b.bunchDate)}</td>
                      <td>${fmt(b.expectedHarvestDate)}</td>
                      <td>${countdownText(b)}</td>
                      <td><span class="badge ${statusClass(
                        b.status
                      )}">${b.status}</span></td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `
          : empty("ยังไม่มีรุ่นการเก็บเกี่ยว")
      }
    </div>
  `;
}

function statCard(label, value, icon) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div>
        <span>${label}</span>
        <b>${value}</b>
      </div>
    </div>
  `;
}

function plotsView() {
  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>ข้อมูลแปลงกล้วย</h3>
          <p>สร้างแปลงก่อน แล้วค่อยบันทึกการออกเครือเมื่อเกิดขึ้นจริง</p>
        </div>

        <div class="filters">
          <input id="plotSearch" placeholder="ค้นหารหัส / ชื่อ / พันธุ์">
          <select id="statusFilter">
            <option value="">ทุกสถานะ</option>
            <option>ยังไม่ออกเครือ</option>
            <option>ยังมีต้นที่ยังไม่ออกเครือ</option>
            <option>รอเก็บเกี่ยว</option>
            <option>ใกล้เก็บเกี่ยว</option>
            <option>ถึงกำหนดเก็บเกี่ยว</option>
            <option>เกินกำหนด</option>
            <option>เก็บเกี่ยวแล้ว</option>
          </select>
        </div>
      </div>

      <div id="plotCards" class="plot-grid">
        ${plotCards(state.plots)}
      </div>
    </div>
  `;
}

function plotCards(plots) {
  if (!plots.length) return empty("ไม่พบข้อมูลแปลง");

  return plots
    .map((p) => {
      const related = state.batches.filter((b) => b.plotId === p.id);
      const activeCount = related
        .filter((b) => b.status !== "เก็บเกี่ยวแล้ว")
        .reduce((sum, b) => sum + Number(b.treeCount || 0), 0);

      return `
        <article class="plot-card">
          <div class="plot-card-top">
            <div>
              <small>${p.id}</small>
              <h3>${escapeHtml(p.name)}</h3>
              <p>${escapeHtml(p.variety)} • ${p.treeCount || 0} ต้น</p>
            </div>
            <span class="badge ${statusClass(p.status)}">${p.status}</span>
          </div>

          <div class="plot-meta">
            <div>
              <span>วันที่ปลูก</span>
              <b>${fmt(p.plantedDate)}</b>
            </div>
            <div>
              <span>จำนวนรุ่น</span>
              <b>${related.length} รุ่น</b>
            </div>
            <div>
              <span>กำลังรอเก็บ</span>
              <b>${activeCount} ต้น</b>
            </div>
            <div>
              <span>ยังไม่ออกเครือ</span>
              <b>${p.remainingUnbunched} ต้น</b>
            </div>
          </div>

          <div class="actions">
            <button class="btn small details-btn" data-id="${p.id}">
              รายละเอียด
            </button>

            ${
              p.remainingUnbunched > 0
                ? `<button class="btn small success bunch-btn" data-id="${p.id}">
                    + บันทึกการออกเครือ
                   </button>`
                : ""
            }

            <button class="btn small qr-btn" data-id="${p.id}">QR</button>
            <button class="btn small edit-btn" data-id="${p.id}">แก้ไขแปลง</button>

            ${
              state.session.user.role === "admin"
                ? `<button class="btn small danger-outline delete-btn" data-id="${p.id}">
                    ลบ
                   </button>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function historyView() {
  const done = state.batches
    .filter((b) => b.actualHarvestDate)
    .sort((a, b) =>
      b.actualHarvestDate.localeCompare(a.actualHarvestDate)
    );

  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>ประวัติการเก็บเกี่ยว</h3>
          <p>รายการรุ่นที่บันทึกว่าเก็บเกี่ยวแล้ว</p>
        </div>
      </div>

      ${
        done.length
          ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>แปลง</th>
                <th>รุ่น</th>
                <th>จำนวนต้น</th>
                <th>วันที่ออกเครือ</th>
                <th>คาดว่าเก็บ</th>
                <th>เก็บจริง</th>
              </tr>
            </thead>
            <tbody>
              ${done
                .map((b) => {
                  const p = state.plots.find((x) => x.id === b.plotId);
                  return `
                    <tr>
                      <td>${b.plotId} ${escapeHtml(p?.name || "")}</td>
                      <td>รุ่น ${b.batchNo}</td>
                      <td>${b.treeCount} ต้น</td>
                      <td>${fmt(b.bunchDate)}</td>
                      <td>${fmt(b.expectedHarvestDate)}</td>
                      <td><b>${fmt(b.actualHarvestDate)}</b></td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `
          : empty("ยังไม่มีประวัติการเก็บเกี่ยว")
      }
    </div>
  `;
}

function usersView() {
  if (state.session.user.role !== "admin") {
    return empty("ไม่มีสิทธิ์เข้าถึง");
  }

  return `
    <div class="panel">
      <div class="panel-head">
        <div>
          <h3>ผู้ใช้งานระบบ</h3>
          <p>Admin สามารถเพิ่มและแก้ไขผู้ใช้งาน</p>
        </div>

        <button class="btn primary" id="addUserBtn">+ เพิ่มผู้ใช้งาน</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ</th>
              <th>Username</th>
              <th>สิทธิ์</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.users
              .map(
                (u) => `
              <tr>
                <td>${u.id}</td>
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.username)}</td>
                <td>${u.role}</td>
                <td>
                  <span class="badge ${
                    u.status === "active" ? "ok" : "muted"
                  }">${u.status}</span>
                </td>
                <td>
                  <button class="btn small user-edit" data-id="${u.id}">
                    แก้ไข
                  </button>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindCommon() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.onclick = () => {
      state.currentView = btn.dataset.view;
      render();
    };
  });

  document.getElementById("logoutBtn").onclick = () => {
    setSession(null);
    renderLogin();
  };

  document.getElementById("quickAdd").onclick = () => openPlotModal();

  const reset = document.getElementById("resetDemo");
  if (reset) {
    reset.onclick = () => {
      if (confirm("รีเซ็ตข้อมูลทดลองทั้งหมด?")) {
        resetDemoDB();
        location.reload();
      }
    };
  }
}

function bindView() {
  if (state.currentView === "plots") {
    const search = document.getElementById("plotSearch");
    const status = document.getElementById("statusFilter");

    const apply = () => {
      const q = search.value.trim().toLowerCase();
      const s = status.value;

      const rows = state.plots.filter((p) => {
        const matchQ =
          !q ||
          [p.id, p.name, p.variety].some((x) =>
            String(x || "")
              .toLowerCase()
              .includes(q)
          );

        const matchS = !s || p.status === s;
        return matchQ && matchS;
      });

      document.getElementById("plotCards").innerHTML = plotCards(rows);
      bindPlotButtons();
    };

    search.oninput = apply;
    status.onchange = apply;
    bindPlotButtons();
  }

  if (state.currentView === "users") {
    document.getElementById("addUserBtn").onclick = () => openUserModal();

    document.querySelectorAll(".user-edit").forEach((b) => {
      b.onclick = () => {
        openUserModal(state.users.find((u) => u.id === b.dataset.id));
      };
    });
  }
}

function bindPlotButtons() {
  document.querySelectorAll(".details-btn").forEach((b) => {
    b.onclick = () => openPlotDetails(b.dataset.id);
  });

  document.querySelectorAll(".bunch-btn").forEach((b) => {
    b.onclick = () => openBatchModal(b.dataset.id);
  });

  document.querySelectorAll(".edit-btn").forEach((b) => {
    b.onclick = () =>
      openPlotModal(state.plots.find((p) => p.id === b.dataset.id));
  });

  document.querySelectorAll(".qr-btn").forEach((b) => {
    b.onclick = () => openQR(b.dataset.id);
  });

  document.querySelectorAll(".delete-btn").forEach((b) => {
    b.onclick = () => deletePlot(b.dataset.id);
  });
}

function ownerOptions(selected = "") {
  if (state.session.user.role !== "admin") return "";

  return `
    <label>
      ผู้รับผิดชอบ
      <select name="userId" required>
        ${state.users
          .filter((u) => u.role === "user" && u.status === "active")
          .map(
            (u) => `
              <option value="${u.id}" ${
              u.id === selected ? "selected" : ""
            }>
                ${escapeHtml(u.name)} (${escapeHtml(u.username)})
              </option>
            `
          )
          .join("")}
      </select>
    </label>
  `;
}

function openPlotModal(plot = null) {
  const p = plot || {};

  const modal = makeModal(`
    <div class="modal-head">
      <div>
        <h3>${plot ? "แก้ไขข้อมูลแปลง" : "เพิ่มแปลงใหม่"}</h3>
        <p class="muted-text">
          ตอนสร้างแปลงยังไม่ต้องกรอกวันที่ออกเครือ
        </p>
      </div>
      <button class="x">×</button>
    </div>

    <form id="plotForm" class="form-grid">
      ${ownerOptions(p.userId)}

      <label>
        ชื่อแปลง
        <input name="name" required value="${escapeHtml(p.name || "")}">
      </label>

      <label>
        พันธุ์กล้วย
        <select name="variety" required>
          ${[
            "กล้วยน้ำว้า",
            "กล้วยหอม",
            "กล้วยไข่",
            "กล้วยเล็บมือนาง",
            "อื่น ๆ",
          ]
            .map(
              (v) =>
                `<option ${p.variety === v ? "selected" : ""}>${v}</option>`
            )
            .join("")}
        </select>
      </label>

      <label>
        จำนวนต้นทั้งหมด
        <input
          name="treeCount"
          type="number"
          min="1"
          required
          value="${p.treeCount || ""}"
        >
      </label>

      <label>
        วันที่ปลูก
        <input
          name="plantedDate"
          type="date"
          value="${p.plantedDate || ""}"
        >
      </label>

      <label class="full-col">
        หมายเหตุ
        <textarea name="note" rows="3">${escapeHtml(p.note || "")}</textarea>
      </label>

      <div class="form-actions full-col">
        <button type="button" class="btn cancel">ยกเลิก</button>
        <button type="submit" class="btn primary">บันทึกแปลง</button>
      </div>
    </form>
  `);

  modal.querySelector(".x").onclick = () => modal.remove();
  modal.querySelector(".cancel").onclick = () => modal.remove();

  modal.querySelector("#plotForm").onsubmit = async (e) => {
    e.preventDefault();

    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.treeCount = Number(fd.treeCount || 0);

    try {
      await api.savePlot(
        state.session.token,
        { ...p, ...fd },
        state.session.user
      );

      modal.remove();
      await refreshData();
      state.currentView = "plots";
      render();
    } catch (err) {
      alert(err.message);
    }
  };
}

function openBatchModal(plotId, batch = null) {
  const plot = state.plots.find((p) => p.id === plotId);
  if (!plot) return;

  const related = state.batches.filter(
    (b) => b.plotId === plotId && b.id !== batch?.id
  );

  const used = related.reduce(
    (sum, b) => sum + Number(b.treeCount || 0),
    0
  );

  const remaining = Math.max(0, Number(plot.treeCount || 0) - used);
  const defaultDays =
    CONFIG.VARIETY_HARVEST_DAYS[plot.variety] ||
    CONFIG.VARIETY_HARVEST_DAYS["อื่น ๆ"] ||
    90;

  const b = batch || {};

  const modal = makeModal(`
    <div class="modal-head">
      <div>
        <h3>${batch ? "แก้ไขรุ่นการออกเครือ" : "บันทึกการออกเครือ"}</h3>
        <p class="muted-text">
          ${escapeHtml(plot.id)} • ${escapeHtml(plot.name)} •
          ${escapeHtml(plot.variety)}
        </p>
      </div>
      <button class="x">×</button>
    </div>

    <div class="info-strip">
      <div>
        <span>จำนวนต้นทั้งหมด</span>
        <b>${plot.treeCount} ต้น</b>
      </div>
      <div>
        <span>บันทึกเป็นรุ่นแล้ว</span>
        <b>${used} ต้น</b>
      </div>
      <div>
        <span>เหลือบันทึกได้</span>
        <b>${remaining} ต้น</b>
      </div>
    </div>

    <form id="batchForm" class="form-grid">
      <label>
        วันที่พบว่าออกเครือ
        <input
          name="bunchDate"
          type="date"
          required
          value="${b.bunchDate || ""}"
        >
      </label>

      <label>
        จำนวนต้นที่ออกเครือในรุ่นนี้
        <input
          name="treeCount"
          type="number"
          min="1"
          max="${remaining}"
          required
          value="${b.treeCount || ""}"
        >
      </label>

      <div class="auto-calc full-col">
        <b>ระบบคำนวณให้อัตโนมัติ</b>
        <p>
          พันธุ์ ${escapeHtml(plot.variety)} ใช้ค่าเริ่มต้น
          <strong>${defaultDays} วัน</strong> หลังออกเครือ
        </p>
        <p class="muted-text">
          ค่านี้เป็นค่าตัวอย่างของระบบ สามารถปรับใน src/config.js ก่อนใช้งานจริง
        </p>
      </div>

      <label class="full-col">
        หมายเหตุ
        <textarea name="note" rows="3">${escapeHtml(b.note || "")}</textarea>
      </label>

      <div class="form-actions full-col">
        <button type="button" class="btn cancel">ยกเลิก</button>
        <button type="submit" class="btn primary">บันทึกรุ่น</button>
      </div>
    </form>
  `);

  modal.querySelector(".x").onclick = () => modal.remove();
  modal.querySelector(".cancel").onclick = () => modal.remove();

  modal.querySelector("#batchForm").onsubmit = async (e) => {
    e.preventDefault();

    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.treeCount = Number(fd.treeCount || 0);
    fd.plotId = plotId;

    try {
      await api.saveBatch(
        state.session.token,
        { ...b, ...fd },
        state.session.user
      );

      modal.remove();
      await refreshData();
      state.currentView = "plots";
      render();
    } catch (err) {
      alert(err.message);
    }
  };
}

function openPlotDetails(plotId) {
  const plot = state.plots.find((p) => p.id === plotId);
  if (!plot) return;

  const related = state.batches
    .filter((b) => b.plotId === plotId)
    .sort((a, b) => Number(a.batchNo) - Number(b.batchNo));

  const modal = makeModal(`
    <div class="modal-head">
      <div>
        <small>${plot.id}</small>
        <h3>${escapeHtml(plot.name)}</h3>
        <p class="muted-text">
          ${escapeHtml(plot.variety)} • ${plot.treeCount} ต้น
        </p>
      </div>
      <button class="x">×</button>
    </div>

    <div class="info-strip">
      <div>
        <span>วันที่ปลูก</span>
        <b>${fmt(plot.plantedDate)}</b>
      </div>
      <div>
        <span>จำนวนรุ่น</span>
        <b>${related.length} รุ่น</b>
      </div>
      <div>
        <span>ยังไม่ออกเครือ</span>
        <b>${plot.remainingUnbunched} ต้น</b>
      </div>
    </div>

    ${
      plot.remainingUnbunched > 0
        ? `<button class="btn primary" id="addBatchFromDetails">
            + บันทึกการออกเครือ
           </button>`
        : ""
    }

    <div class="batch-list">
      ${
        related.length
          ? related
              .map(
                (b) => `
            <div class="batch-item">
              <div class="batch-main">
                <div>
                  <b>รุ่น ${b.batchNo}</b>
                  <span class="badge ${statusClass(b.status)}">${b.status}</span>
                </div>
                <small>${b.id}</small>
              </div>

              <div class="batch-grid">
                <div>
                  <span>ออกเครือ</span>
                  <b>${fmt(b.bunchDate)}</b>
                </div>
                <div>
                  <span>จำนวน</span>
                  <b>${b.treeCount} ต้น</b>
                </div>
                <div>
                  <span>คาดว่าเก็บ</span>
                  <b>${fmt(b.expectedHarvestDate)}</b>
                </div>
                <div>
                  <span>เวลาคงเหลือ</span>
                  <b>${b.actualHarvestDate ? "เก็บแล้ว" : countdownText(b)}</b>
                </div>
              </div>

              <div class="actions">
                <button
                  class="btn small edit-batch"
                  data-id="${b.id}"
                >
                  แก้ไขรุ่น
                </button>

                ${
                  !b.actualHarvestDate
                    ? `<button
                        class="btn small success harvest-batch"
                        data-id="${b.id}"
                      >
                        บันทึกว่าเก็บแล้ว
                      </button>`
                    : `<span class="muted-text">
                        เก็บจริง ${fmt(b.actualHarvestDate)}
                       </span>`
                }
              </div>
            </div>
          `
              )
              .join("")
          : empty("แปลงนี้ยังไม่มีการบันทึกการออกเครือ")
      }
    </div>
  `);

  modal.querySelector(".x").onclick = () => modal.remove();

  const addBtn = modal.querySelector("#addBatchFromDetails");
  if (addBtn) {
    addBtn.onclick = () => {
      modal.remove();
      openBatchModal(plotId);
    };
  }

  modal.querySelectorAll(".edit-batch").forEach((btn) => {
    btn.onclick = () => {
      const batch = state.batches.find((b) => b.id === btn.dataset.id);
      modal.remove();
      openBatchModal(plotId, batch);
    };
  });

  modal.querySelectorAll(".harvest-batch").forEach((btn) => {
    btn.onclick = async () => {
      const date = prompt(
        "วันที่เก็บเกี่ยวจริง (YYYY-MM-DD)",
        new Date().toISOString().slice(0, 10)
      );
      if (!date) return;

      try {
        await api.markBatchHarvested(
          state.session.token,
          btn.dataset.id,
          date,
          state.session.user
        );

        modal.remove();
        await refreshData();
        render();
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

function openUserModal(user = null) {
  const u = user || {};

  const modal = makeModal(`
    <div class="modal-head">
      <h3>${user ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}</h3>
      <button class="x">×</button>
    </div>

    <form id="userForm" class="form-grid">
      <label>
        ชื่อ
        <input name="name" required value="${escapeHtml(u.name || "")}">
      </label>

      <label>
        Username
        <input
          name="username"
          required
          value="${escapeHtml(u.username || "")}"
        >
      </label>

      <label>
        รหัสผ่าน
        <input
          name="password"
          type="password"
          ${user ? "" : "required"}
          placeholder="${user ? "เว้นว่างถ้าไม่เปลี่ยน" : ""}"
        >
      </label>

      <label>
        สิทธิ์
        <select name="role">
          <option value="user" ${u.role !== "admin" ? "selected" : ""}>
            user
          </option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>
            admin
          </option>
        </select>
      </label>

      <label>
        สถานะ
        <select name="status">
          <option value="active" ${
            u.status !== "inactive" ? "selected" : ""
          }>
            active
          </option>
          <option value="inactive" ${
            u.status === "inactive" ? "selected" : ""
          }>
            inactive
          </option>
        </select>
      </label>

      <div class="form-actions full-col">
        <button type="button" class="btn cancel">ยกเลิก</button>
        <button class="btn primary">บันทึก</button>
      </div>
    </form>
  `);

  modal.querySelector(".x").onclick = () => modal.remove();
  modal.querySelector(".cancel").onclick = () => modal.remove();

  modal.querySelector("#userForm").onsubmit = async (e) => {
    e.preventDefault();

    const fd = Object.fromEntries(new FormData(e.target).entries());

    try {
      await api.saveUser(
        state.session.token,
        { ...u, ...fd }
      );

      modal.remove();
      await refreshData();
      render();
    } catch (err) {
      alert(err.message);
    }
  };
}

function openQR(plotId) {
  const base =
    CONFIG.PUBLIC_APP_URL || location.origin + location.pathname;

  const url = `${base}?plot=${encodeURIComponent(plotId)}`;

  const modal = makeModal(`
    <div class="modal-head">
      <h3>QR Code • ${plotId}</h3>
      <button class="x">×</button>
    </div>

    <div class="qr-box">
      <div id="qrCanvas"></div>
      <p>สแกนเพื่อดูข้อมูลแปลงและรุ่นการเก็บเกี่ยว</p>
      <code>${escapeHtml(url)}</code>
      <button id="downloadQR" class="btn primary">ดาวน์โหลด QR</button>
    </div>
  `);

  modal.querySelector(".x").onclick = () => modal.remove();

  const qrBox = modal.querySelector("#qrCanvas");

  if (typeof QRCode === "undefined") {
    qrBox.innerHTML =
      "<p style='color:#b33c32'>โหลดไลบรารี QR Code ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต</p>";
    return;
  }

  new QRCode(qrBox, {
    text: url,
    width: 240,
    height: 240,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });

  modal.querySelector("#downloadQR").onclick = () => {
    const canvas = qrBox.querySelector("canvas");
    const img = qrBox.querySelector("img");
    const dataUrl = canvas
      ? canvas.toDataURL("image/png")
      : img
      ? img.src
      : "";

    if (!dataUrl) {
      alert("ยังสร้าง QR Code ไม่สำเร็จ");
      return;
    }

    const a = document.createElement("a");
    a.download = `QR_${plotId}.png`;
    a.href = dataUrl;
    a.click();
  };
}

async function deletePlot(plotId) {
  if (!confirm(`ลบแปลง ${plotId} และข้อมูลรุ่นทั้งหมดของแปลงนี้หรือไม่?`)) {
    return;
  }

  try {
    await api.deletePlot(state.session.token, plotId);
    await refreshData();
    render();
  } catch (err) {
    alert(err.message);
  }
}

function renderPublicPlot() {
  const { plot, batches } = state.publicData;

  app.innerHTML = `
    <main class="public-shell">
      <section class="public-card">
        <div class="brand-mark">🍌</div>

        <small>${plot.id}</small>
        <h1>${escapeHtml(plot.name)}</h1>
        <p>${escapeHtml(plot.variety)} • ${plot.treeCount || 0} ต้น</p>

        <span class="badge large ${statusClass(plot.status)}">
          ${plot.status}
        </span>

        <div class="public-grid">
          <div>
            <span>วันที่ปลูก</span>
            <b>${fmt(plot.plantedDate)}</b>
          </div>
          <div>
            <span>จำนวนรุ่น</span>
            <b>${batches.length} รุ่น</b>
          </div>
          <div>
            <span>ยังไม่ออกเครือ</span>
            <b>${plot.remainingUnbunched} ต้น</b>
          </div>
          <div>
            <span>สถานะแปลง</span>
            <b>${plot.status}</b>
          </div>
        </div>

        <div class="public-batches">
          <h3>รุ่นการเก็บเกี่ยว</h3>

          ${
            batches.length
              ? batches
                  .sort((a, b) => Number(a.batchNo) - Number(b.batchNo))
                  .map(
                    (b) => `
                <div class="batch-item public-batch">
                  <div class="batch-main">
                    <b>รุ่น ${b.batchNo}</b>
                    <span class="badge ${statusClass(b.status)}">
                      ${b.status}
                    </span>
                  </div>

                  <div class="batch-grid">
                    <div>
                      <span>วันที่ออกเครือ</span>
                      <b>${fmt(b.bunchDate)}</b>
                    </div>
                    <div>
                      <span>จำนวนต้น</span>
                      <b>${b.treeCount} ต้น</b>
                    </div>
                    <div>
                      <span>คาดว่าเก็บ</span>
                      <b>${fmt(b.expectedHarvestDate)}</b>
                    </div>
                    <div>
                      <span>เก็บจริง</span>
                      <b>${fmt(b.actualHarvestDate)}</b>
                    </div>
                  </div>
                </div>
              `
                  )
                  .join("")
              : empty("ยังไม่มีการบันทึกการออกเครือ")
          }
        </div>

        ${
          plot.note
            ? `
          <div class="note-box">
            <b>หมายเหตุ</b>
            <p>${escapeHtml(plot.note)}</p>
          </div>
        `
            : ""
        }

        <a class="btn primary link-btn" href="${location.pathname}">
          เข้าสู่ระบบ
        </a>
      </section>
    </main>
  `;
}

function countdownText(batch) {
  const d = daysLeft(batch.expectedHarvestDate);

  if (d === null) return "ยังไม่มีวันคาดเก็บ";
  if (d < 0) return `เลยกำหนด ${Math.abs(d)} วัน`;
  if (d === 0) return "ถึงกำหนดวันนี้";
  return `${d} วัน`;
}

function makeModal(html) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(wrap);

  wrap.onclick = (e) => {
    if (e.target === wrap) wrap.remove();
  };

  return wrap;
}

function empty(msg) {
  return `
    <div class="empty">
      <div>🍌</div>
      <p>${msg}</p>
    </div>
  `;
}

function errorPage(msg) {
  return `
    <main class="login-shell">
      <section class="login-card">
        <h1>เกิดข้อผิดพลาด</h1>
        <p>${escapeHtml(msg)}</p>
        <a class="btn primary link-btn" href="${location.pathname}">
          กลับหน้าหลัก
        </a>
      </section>
    </main>
  `;
}

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m])
  );
}

boot();

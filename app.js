import { CONFIG } from "./config.js?v=20261006-simple1";
import { api } from "./api.js?v=20261006-simple1";

const app = document.getElementById("app");

const state = {
  session: readSession(),
  plots: [],
  bunches: [],
  users: [],
  view: "home",
};

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem("banana_session") || "null");
  } catch {
    return null;
  }
}

function setSession(value) {
  state.session = value;
  if (value) {
    sessionStorage.setItem("banana_session", JSON.stringify(value));
  } else {
    sessionStorage.removeItem("banana_session");
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function todayString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysLeft(date) {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target - now) / 86400000);
}

function remainingText(bunch) {
  if (bunch.actualHarvestDate) return "เก็บเกี่ยวแล้ว";
  const days = daysLeft(bunch.expectedHarvestDate);
  if (days === null) return "รอข้อมูล";
  if (days < 0) return `เลยกำหนด ${Math.abs(days)} วัน`;
  if (days === 0) return "ถึงกำหนดวันนี้";
  return `เหลือ ${days} วัน`;
}

function statusClass(status = "") {
  if (status.includes("เก็บเกี่ยวแล้ว") || status.includes("เก็บเกี่ยวครบ")) return "status-good";
  if (status.includes("ใกล้")) return "status-warn";
  if (status.includes("เกิน") || status.includes("ถึงกำหนด")) return "status-danger";
  if (status.includes("ยังไม่") || status.includes("รอออกเครือ")) return "status-muted";
  return "status-info";
}

async function boot() {

  if (!state.session) {
    renderLogin();
    return;
  }

  try {
    await refreshData();
    render();
  } catch (error) {
    setSession(null);
    renderLogin(error.message);
  }
}

async function refreshData() {
  const { token, user } = state.session;
  state.plots = await api.getPlots(token);
  state.bunches = await api.getBunches(token);
  state.users = user.role === "admin" ? await api.getUsers(token) : [];
}

function renderLogin(errorMessage = "") {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="banana-icon">🍌</div>
        <h1>${CONFIG.APP_NAME}</h1>
        <p class="lead">กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าสู่ระบบ</p>

        <form id="loginForm" class="form-stack">
          <label class="field">
            <span>ชื่อผู้ใช้</span>
            <input name="username" autocomplete="username" required placeholder="กรอกชื่อผู้ใช้">
          </label>

          <label class="field">
            <span>รหัสผ่าน</span>
            <input id="passwordInput" name="password" type="password" autocomplete="current-password" required placeholder="กรอกรหัสผ่าน">
          </label>

          <label class="show-password">
            <input id="showPassword" type="checkbox">
            <span>แสดงรหัสผ่าน</span>
          </label>

          <button class="button primary big" type="submit">เข้าสู่ระบบ</button>
          <p id="loginError" class="error-text">${escapeHtml(errorMessage)}</p>
        </form>
      </section>
    </main>
  `;

  document.getElementById("showPassword").onchange = (event) => {
    document.getElementById("passwordInput").type = event.target.checked ? "text" : "password";
  };

  document.getElementById("loginForm").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const error = document.getElementById("loginError");
    const form = new FormData(event.target);

    button.disabled = true;
    button.textContent = "กำลังเข้าสู่ระบบ...";
    error.textContent = "";

    try {
      const result = await api.login(form.get("username"), form.get("password"));
      setSession(result);
      await refreshData();
      state.view = "home";
      render();
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
      button.textContent = "เข้าสู่ระบบ";
    }
  };
}

function render() {
  const content = {
    home: homeView,
    plots: plotsView,
    history: historyView,
    users: usersView,
  }[state.view]?.() || homeView();

  app.innerHTML = layout(content);
  bindLayout();
  bindView();
}

function layout(content) {
  const user = state.session.user;
  const isAdmin = user.role === "admin";

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-box">
          <span class="brand-icon">🍌</span>
          <div>
            <strong>ระบบติดตามการเก็บเกี่ยวกล้วย</strong>
           
          </div>
        </div>

        <div class="user-box">
          <div class="user-avatar">${escapeHtml(user.name?.slice(0, 1) || "ผ")}</div>
          <div>
            <strong>${escapeHtml(user.name || user.username)}</strong>
            <small>${isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}</small>
          </div>
        </div>

        <nav class="menu">
          ${menuButton("home", "🏠", "หน้าหลัก")}
          ${menuButton("plots", "🌱", "ข้อมูลแปลง")}
          ${menuButton("history", "✅", "ประวัติการเก็บ")}
          ${isAdmin ? menuButton("users", "👥", "ผู้ใช้งาน") : ""}
        </nav>

        <button id="logoutBtn" class="button outline logout">ออกจากระบบ</button>
      </aside>

      <main class="main-area">
        <header class="topbar">
          <div>
            <h2>${viewTitle()}</h2>
            <p>${new Date().toLocaleDateString("th-TH", { dateStyle: "long" })}</p>
          </div>
          ${state.view === "plots" ? '<button id="addPlotTop" class="button primary">+ เพิ่มแปลง</button>' : ""}
        </header>
        <section class="content">${content}</section>
      </main>
    </div>
  `;
}

function menuButton(view, icon, label) {
  return `
    <button class="menu-button ${state.view === view ? "active" : ""}" data-view="${view}">
      <span>${icon}</span><b>${label}</b>
    </button>
  `;
}

function viewTitle() {
  return {
    home: "หน้าหลัก",
    plots: "ข้อมูลแปลง",
    history: "ประวัติการเก็บเกี่ยว",
    users: "จัดการผู้ใช้งาน",
  }[state.view] || "หน้าหลัก";
}

function bindLayout() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.onclick = () => {
      state.view = button.dataset.view;
      render();
    };
  });

  document.getElementById("logoutBtn").onclick = () => {
    setSession(null);
    renderLogin();
  };

  const add = document.getElementById("addPlotTop");
  if (add) add.onclick = () => openPlotModal();
}

function homeView() {
  const active = state.bunches.filter((b) => !b.actualHarvestDate);
  const near = active.filter((b) => b.status === "ใกล้เก็บเกี่ยว").length;
  const due = active.filter((b) => ["ถึงกำหนดเก็บเกี่ยว", "เกินกำหนด"].includes(b.status)).length;

  const urgent = active
    .filter((b) => b.expectedHarvestDate)
    .sort((a, b) => a.expectedHarvestDate.localeCompare(b.expectedHarvestDate))
    .slice(0, 8);

  return `
    <div class="summary-grid">
      ${summaryCard("🍌", "แปลงทั้งหมด", state.plots.length)}
      ${summaryCard("🟠", "ใกล้เก็บเกี่ยว", near)}
      ${summaryCard("🔴", "ถึง/เกินกำหนด", due)}
    </div>

    <section class="panel">
      <div class="section-title">
        <div>
          <h3>สิ่งที่ต้องดู</h3>
          <p>เรียงจากวันที่ใกล้เก็บเกี่ยวที่สุด</p>
        </div>
      </div>
      <div class="simple-list">
        ${urgent.length ? urgent.map(urgentCard).join("") : emptyState("ยังไม่มีรายการที่ต้องติดตาม")}
      </div>
    </section>
  `;
}

function summaryCard(icon, label, value) {
  return `
    <div class="summary-card">
      <span class="summary-icon">${icon}</span>
      <div><span>${label}</span><strong>${value}</strong></div>
    </div>
  `;
}

function urgentCard(bunch) {
  const plot = state.plots.find((p) => p.id === bunch.plotId);
  return `
    <article class="urgent-card">
      <div>
        <strong>${escapeHtml(plot?.name || bunch.plotId)}</strong>
        <span>${escapeHtml(plot?.variety || "")}</span>
      </div>
      <div>
        <span>คาดว่าเก็บ</span>
        <strong>${formatDate(bunch.expectedHarvestDate)}</strong>
      </div>
      <div>
        <span>คงเหลือ</span>
        <strong>${remainingText(bunch)}</strong>
      </div>
      <span class="status ${statusClass(bunch.status)}">${escapeHtml(bunch.status)}</span>
    </article>
  `;
}

function plotsView() {
  const isAdmin = state.session.user.role === "admin";
  return `
    <section class="panel">
      <div class="section-title responsive-title">
        <div>
          <h3>${isAdmin ? "แปลงทั้งหมด" : "แปลงของฉัน"}</h3>
          <p>เลือกสิ่งที่ต้องการทำจากปุ่มด้านล่าง</p>
        </div>
        <input id="plotSearch" class="search-box" placeholder="ค้นหาชื่อแปลงหรือรหัส">
      </div>
      <div id="plotGrid" class="plot-grid">${plotCards(state.plots)}</div>
    </section>
  `;
}

function plotCards(plots) {
  if (!plots.length) return emptyState("ยังไม่มีข้อมูลแปลง");
  const isAdmin = state.session.user.role === "admin";

  return plots.map((plot) => `
    <article class="plot-card">
      <div class="plot-head">
        <div>
          <small>${escapeHtml(plot.id)}</small>
          <h3>${escapeHtml(plot.name)}</h3>
          <p>${escapeHtml(plot.variety)}</p>
        </div>
        <span class="status ${statusClass(plot.status)}">${escapeHtml(plot.status)}</span>
      </div>

      <div class="plot-numbers">
        <div><span>จำนวนหลุม</span><strong>${Number(plot.holeCount || 0)} หลุม</strong></div>
        <div><span>จำนวนต้น</span><strong>${Number(plot.treeCount || 0)} ต้น</strong></div>
      </div>

      ${isAdmin ? `<div class="owner-line">👤 ผู้ดูแล: <strong>${escapeHtml(plot.ownerName || "ยังไม่ระบุ")}</strong></div>` : ""}

      <div class="plot-actions">
        <button class="button soft details-btn" data-id="${plot.id}">ดูข้อมูล</button>
        <button class="button primary bunch-btn" data-id="${plot.id}">บันทึกออกเครือ</button>
        <button class="button soft edit-plot-btn" data-id="${plot.id}">แก้ไข</button>
        ${isAdmin ? `<button class="button danger-soft delete-plot-btn" data-id="${plot.id}">ลบแปลง</button>` : ""}
      </div>
    </article>
  `).join("");
}

function historyView() {
  const history = state.bunches
    .filter((b) => b.actualHarvestDate)
    .sort((a, b) => b.actualHarvestDate.localeCompare(a.actualHarvestDate));

  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h3>รายการที่เก็บเกี่ยวแล้ว</h3>
          <p>ดูข้อมูลย้อนหลังแบบอ่านง่าย</p>
        </div>
      </div>
      <div class="history-grid">
        ${history.length ? history.map(historyCard).join("") : emptyState("ยังไม่มีประวัติการเก็บเกี่ยว")}
      </div>
    </section>
  `;
}

function historyCard(bunch) {
  const plot = state.plots.find((p) => p.id === bunch.plotId);
  return `
    <article class="history-card">
      <h3>${escapeHtml(plot?.name || bunch.plotId)}</h3>
      <p>${escapeHtml(plot?.variety || "")}</p>
      <div class="history-row"><span>ออกเครือ</span><strong>${formatDate(bunch.bunchDate)}</strong></div>
      <div class="history-row"><span>จำนวน</span><strong>${bunch.treeCount} ต้น</strong></div>
      <div class="history-row"><span>เก็บจริง</span><strong>${formatDate(bunch.actualHarvestDate)}</strong></div>
    </article>
  `;
}

function usersView() {
  if (state.session.user.role !== "admin") return emptyState("ไม่มีสิทธิ์เข้าถึงหน้านี้");

  return `
    <section class="panel">
      <div class="section-title responsive-title">
        <div>
          <h3>ผู้ใช้งาน</h3>
          <p>ดูว่าใครรับผิดชอบแปลงไหน</p>
        </div>
        <button id="addUserBtn" class="button primary">+ เพิ่มผู้ใช้งาน</button>
      </div>
      <div class="user-grid">
        ${state.users.map(userCard).join("")}
      </div>
    </section>
  `;
}

function userCard(user) {
  const plots = state.plots.filter((p) => p.userId === user.id);
  return `
    <article class="manage-user-card">
      <div class="user-card-head">
        <div>
          <h3>${escapeHtml(user.name)}</h3>
          <p>ชื่อผู้ใช้: ${escapeHtml(user.username)}</p>
        </div>
        <span class="status ${user.status === "active" ? "status-good" : "status-muted"}">${user.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</span>
      </div>
      <div class="assigned-plots">
        <span>แปลงที่รับผิดชอบ</span>
        <strong>${plots.length ? plots.map((p) => escapeHtml(p.name)).join(", ") : "ยังไม่มี"}</strong>
      </div>
      <button class="button soft edit-user-btn" data-id="${user.id}">แก้ไขผู้ใช้งาน</button>
    </article>
  `;
}

function bindView() {
  if (state.view === "plots") {
    document.getElementById("plotSearch").oninput = (event) => {
      const q = event.target.value.trim().toLowerCase();
      const filtered = state.plots.filter((p) => [p.id, p.name, p.variety, p.ownerName].some((value) => String(value || "").toLowerCase().includes(q)));
      document.getElementById("plotGrid").innerHTML = plotCards(filtered);
      bindPlotButtons();
    };
    bindPlotButtons();
  }

  if (state.view === "users") {
    document.getElementById("addUserBtn").onclick = () => openUserModal();
    document.querySelectorAll(".edit-user-btn").forEach((button) => {
      button.onclick = () => openUserModal(state.users.find((u) => u.id === button.dataset.id));
    });
  }
}

function bindPlotButtons() {
  document.querySelectorAll(".details-btn").forEach((button) => {
    button.onclick = () => openPlotDetails(button.dataset.id);
  });
  document.querySelectorAll(".bunch-btn").forEach((button) => {
    button.onclick = () => openBunchModal(button.dataset.id);
  });
  document.querySelectorAll(".edit-plot-btn").forEach((button) => {
    button.onclick = () => openPlotModal(state.plots.find((p) => p.id === button.dataset.id));
  });
  document.querySelectorAll(".delete-plot-btn").forEach((button) => {
    button.onclick = () => deletePlot(button.dataset.id);
  });
}

function ownerOptions(selected) {
  if (state.session.user.role !== "admin") return "";
  const users = state.users.filter((u) => u.role === "user" && u.status === "active");
  return `
    <label class="field">
      <span>ผู้ดูแลแปลง</span>
      <select name="userId" required>
        <option value="">เลือกผู้ดูแล</option>
        ${users.map((u) => `<option value="${u.id}" ${u.id === selected ? "selected" : ""}>${escapeHtml(u.name)}</option>`).join("")}
      </select>
    </label>
  `;
}

function openPlotModal(plot = null) {
  const data = plot || {};
  const modal = makeModal(`
    <div class="modal-head">
      <div><h3>${plot ? "แก้ไขข้อมูลแปลง" : "เพิ่มแปลงใหม่"}</h3><p>กรอกเฉพาะข้อมูลที่จำเป็น</p></div>
      <button class="close-button" aria-label="ปิด">×</button>
    </div>

    <form id="plotForm" class="form-grid">
      ${ownerOptions(data.userId)}
      <label class="field"><span>ชื่อแปลง</span><input name="name" required value="${escapeHtml(data.name || "")}" placeholder="เช่น แปลง A"></label>
      <label class="field">
        <span>พันธุ์กล้วย</span>
        <select name="variety" required>
          ${["กล้วยน้ำว้า", "กล้วยหอม", "กล้วยไข่", "กล้วยเล็บมือนาง", "อื่น ๆ"].map((v) => `<option ${data.variety === v ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </label>
      <label class="field"><span>จำนวนหลุม</span><input name="holeCount" type="number" inputmode="numeric" min="0" required value="${data.holeCount ?? ""}" placeholder="เช่น 100"></label>
      <label class="field"><span>จำนวนต้น</span><input name="treeCount" type="number" inputmode="numeric" min="1" required value="${data.treeCount ?? ""}" placeholder="เช่น 100"></label>
      <label class="field full"><span>หมายเหตุ (ถ้ามี)</span><textarea name="note" rows="3" placeholder="ไม่กรอกก็ได้">${escapeHtml(data.note || "")}</textarea></label>
      <div class="modal-actions full">
        <button type="button" class="button outline cancel">ยกเลิก</button>
        <button type="submit" class="button primary">บันทึก</button>
      </div>
    </form>
  `);

  modal.querySelector(".close-button").onclick = () => modal.remove();
  modal.querySelector(".cancel").onclick = () => modal.remove();
  modal.querySelector("#plotForm").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const values = Object.fromEntries(new FormData(event.target).entries());
    values.holeCount = Number(values.holeCount || 0);
    values.treeCount = Number(values.treeCount || 0);
    button.disabled = true;

    try {
      await api.savePlot(state.session.token, { ...data, ...values });
      modal.remove();
      await refreshData();
      state.view = "plots";
      render();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  };
}

function openBunchModal(plotId, bunch = null) {
  const plot = state.plots.find((p) => p.id === plotId);
  if (!plot) return;

  const others = state.bunches.filter((b) => b.plotId === plotId && b.id !== bunch?.id);
  const used = others.reduce((sum, b) => sum + Number(b.treeCount || 0), 0);
  const remaining = Math.max(0, Number(plot.treeCount || 0) - used);
  const data = bunch || {};

  const modal = makeModal(`
    <div class="modal-head">
      <div><h3>${bunch ? "แก้ไขการออกเครือ" : "บันทึกการออกเครือ"}</h3><p>${escapeHtml(plot.name)} • เหลือบันทึกได้ ${remaining} ต้น</p></div>
      <button class="close-button">×</button>
    </div>

    <form id="bunchForm" class="form-stack">
      <label class="field">
        <span>วันที่ออกเครือ</span>
        <div class="date-line">
          <input id="bunchDate" name="bunchDate" type="date" required value="${data.bunchDate || ""}">
          <button type="button" id="todayBunch" class="button soft">วันนี้</button>
        </div>
      </label>
      <label class="field"><span>จำนวนต้นที่ออกเครือ</span><input name="treeCount" type="number" inputmode="numeric" min="1" max="${remaining}" required value="${data.treeCount ?? ""}" placeholder="เช่น 10"></label>
      <div class="notice-box">ระบบจะคำนวณวันที่คาดว่าจะเก็บเกี่ยวให้อัตโนมัติ</div>
      <label class="field"><span>หมายเหตุ (ถ้ามี)</span><textarea name="note" rows="3">${escapeHtml(data.note || "")}</textarea></label>
      <div class="modal-actions">
        <button type="button" class="button outline cancel">ยกเลิก</button>
        <button type="submit" class="button primary">บันทึก</button>
      </div>
    </form>
  `);

  modal.querySelector(".close-button").onclick = () => modal.remove();
  modal.querySelector(".cancel").onclick = () => modal.remove();
  modal.querySelector("#todayBunch").onclick = () => { modal.querySelector("#bunchDate").value = todayString(); };
  modal.querySelector("#bunchForm").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const values = Object.fromEntries(new FormData(event.target).entries());
    values.plotId = plotId;
    values.treeCount = Number(values.treeCount || 0);
    button.disabled = true;

    try {
      await api.saveBunch(state.session.token, { ...data, ...values });
      modal.remove();
      await refreshData();
      state.view = "plots";
      render();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  };
}

function openPlotDetails(plotId) {
  const plot = state.plots.find((p) => p.id === plotId);
  if (!plot) return;
  const bunches = state.bunches
    .filter((b) => b.plotId === plotId)
    .sort((a, b) => b.bunchDate.localeCompare(a.bunchDate));
  const isAdmin = state.session.user.role === "admin";

  const modal = makeModal(`
    <div class="modal-head">
      <div><small>${escapeHtml(plot.id)}</small><h3>${escapeHtml(plot.name)}</h3><p>${escapeHtml(plot.variety)}</p></div>
      <button class="close-button">×</button>
    </div>

    <div class="detail-summary">
      <div><span>จำนวนหลุม</span><strong>${plot.holeCount} หลุม</strong></div>
      <div><span>จำนวนต้น</span><strong>${plot.treeCount} ต้น</strong></div>
      <div><span>ยังไม่ออกเครือ</span><strong>${plot.remainingUnbunched} ต้น</strong></div>
    </div>
    ${isAdmin ? `<div class="owner-banner">👤 ผู้ดูแลแปลง: <strong>${escapeHtml(plot.ownerName || "ยังไม่ระบุ")}</strong></div>` : ""}

    ${plot.remainingUnbunched > 0 ? `<button id="addBunchHere" class="button primary wide">+ บันทึกการออกเครือ</button>` : ""}

    <div class="bunch-list">
      ${bunches.length ? bunches.map(bunchDetailCard).join("") : emptyState("แปลงนี้ยังไม่มีการบันทึกการออกเครือ")}
    </div>
  `);

  modal.querySelector(".close-button").onclick = () => modal.remove();
  const add = modal.querySelector("#addBunchHere");
  if (add) add.onclick = () => { modal.remove(); openBunchModal(plotId); };

  modal.querySelectorAll(".edit-bunch-btn").forEach((button) => {
    button.onclick = () => {
      const bunch = state.bunches.find((b) => b.id === button.dataset.id);
      modal.remove();
      openBunchModal(plotId, bunch);
    };
  });

  modal.querySelectorAll(".harvest-btn").forEach((button) => {
    button.onclick = () => openHarvestModal(button.dataset.id, modal);
  });
}

function bunchDetailCard(bunch) {
  return `
    <article class="bunch-card">
      <div class="bunch-card-head">
        <strong>ออกเครือ ${formatDate(bunch.bunchDate)}</strong>
        <span class="status ${statusClass(bunch.status)}">${escapeHtml(bunch.status)}</span>
      </div>
      <div class="bunch-info">
        <div><span>จำนวน</span><strong>${bunch.treeCount} ต้น</strong></div>
        <div><span>คาดว่าเก็บ</span><strong>${formatDate(bunch.expectedHarvestDate)}</strong></div>
        <div><span>คงเหลือ</span><strong>${remainingText(bunch)}</strong></div>
      </div>
      <div class="small-actions">
        <button class="button soft edit-bunch-btn" data-id="${bunch.id}">แก้ไข</button>
        ${bunch.actualHarvestDate ? `<span class="harvested-text">เก็บจริง ${formatDate(bunch.actualHarvestDate)}</span>` : `<button class="button success harvest-btn" data-id="${bunch.id}">บันทึกว่าเก็บแล้ว</button>`}
      </div>
    </article>
  `;
}

function openHarvestModal(bunchId, parentModal) {
  const bunch = state.bunches.find((b) => b.id === bunchId);
  if (!bunch) return;

  const modal = makeModal(`
    <div class="modal-head">
      <div><h3>บันทึกการเก็บเกี่ยว</h3><p>เลือกวันที่เก็บจริง</p></div>
      <button class="close-button">×</button>
    </div>
    <form id="harvestForm" class="form-stack">
      <label class="field">
        <span>วันที่เก็บเกี่ยว</span>
        <div class="date-line">
          <input id="harvestDate" name="date" type="date" required value="${todayString()}">
          <button type="button" id="todayHarvest" class="button soft">วันนี้</button>
        </div>
      </label>
      <div class="modal-actions">
        <button type="button" class="button outline cancel">ยกเลิก</button>
        <button type="submit" class="button primary">บันทึกว่าเก็บแล้ว</button>
      </div>
    </form>
  `);

  modal.querySelector(".close-button").onclick = () => modal.remove();
  modal.querySelector(".cancel").onclick = () => modal.remove();
  modal.querySelector("#todayHarvest").onclick = () => { modal.querySelector("#harvestDate").value = todayString(); };
  modal.querySelector("#harvestForm").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    const date = new FormData(event.target).get("date");
    try {
      await api.markHarvested(state.session.token, bunchId, date);
      modal.remove();
      parentModal?.remove();
      await refreshData();
      render();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  };
}

function openUserModal(user = null) {
  const data = user || {};
  const modal = makeModal(`
    <div class="modal-head"><div><h3>${user ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}</h3></div><button class="close-button">×</button></div>
    <form id="userForm" class="form-stack">
      <label class="field"><span>ชื่อ</span><input name="name" required value="${escapeHtml(data.name || "")}"></label>
      <label class="field"><span>ชื่อผู้ใช้</span><input name="username" required value="${escapeHtml(data.username || "")}"></label>
      <label class="field"><span>รหัสผ่าน</span><input name="password" type="password" ${user ? "" : "required"} placeholder="${user ? "เว้นว่างถ้าไม่เปลี่ยน" : "กรอกรหัสผ่าน"}"></label>
      <label class="field"><span>สิทธิ์</span><select name="role"><option value="user" ${data.role !== "admin" ? "selected" : ""}>ผู้ใช้งาน</option><option value="admin" ${data.role === "admin" ? "selected" : ""}>ผู้ดูแลระบบ</option></select></label>
      <label class="field"><span>สถานะ</span><select name="status"><option value="active" ${data.status !== "inactive" ? "selected" : ""}>ใช้งาน</option><option value="inactive" ${data.status === "inactive" ? "selected" : ""}>ปิดใช้งาน</option></select></label>
      <div class="modal-actions"><button type="button" class="button outline cancel">ยกเลิก</button><button type="submit" class="button primary">บันทึก</button></div>
    </form>
  `);
  modal.querySelector(".close-button").onclick = () => modal.remove();
  modal.querySelector(".cancel").onclick = () => modal.remove();
  modal.querySelector("#userForm").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const values = Object.fromEntries(new FormData(event.target).entries());
    button.disabled = true;
    try {
      await api.saveUser(state.session.token, { ...data, ...values });
      modal.remove();
      await refreshData();
      render();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  };
}

async function deletePlot(plotId) {
  if (!confirm(`ต้องการลบแปลง ${plotId} หรือไม่?`)) return;
  try {
    await api.deletePlot(state.session.token, plotId);
    await refreshData();
    render();
  } catch (error) {
    alert(error.message);
  }
}

function makeModal(content) {
  const wrapper = document.createElement("div");
  wrapper.className = "modal-backdrop";
  wrapper.innerHTML = `<div class="modal">${content}</div>`;
  document.body.appendChild(wrapper);
  wrapper.onclick = (event) => { if (event.target === wrapper) wrapper.remove(); };
  return wrapper;
}

function emptyState(message) {
  return `<div class="empty-state"><span>🍌</span><p>${escapeHtml(message)}</p></div>`;
}

boot();

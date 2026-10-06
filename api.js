import { CONFIG } from "./config.js?v=20261006-simple1";

async function remote(action, payload = {}, token = "") {
  if (!CONFIG.API_URL) {
    throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล");
  }

  const separator = CONFIG.API_URL.includes("?") ? "&" : "?";
  const url = `${CONFIG.API_URL}${separator}_=${Date.now()}`;

  const response = await fetch(url, {
    method: "POST",
    redirect: "follow",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({ action, token, payload }),
  });

  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch (error) {
    console.error("API response:", text);
    throw new Error("เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  if (!result.ok) {
    throw new Error(result.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
  }

  return result.data;
}

export const api = {
  login(username, password) {
    return remote("login", { username, password });
  },
  getUsers(token) {
    return remote("getUsers", {}, token);
  },
  saveUser(token, user) {
    return remote("saveUser", user, token);
  },
  getPlots(token) {
    return remote("getPlots", {}, token);
  },
  getBunches(token) {
    return remote("getBunches", {}, token);
  },
  savePlot(token, plot) {
    return remote("savePlot", plot, token);
  },
  deletePlot(token, plotId) {
    return remote("deletePlot", { plotId }, token);
  },
  saveBunch(token, bunch) {
    return remote("saveBunch", bunch, token);
  },
  markHarvested(token, bunchId, date) {
    return remote("markHarvested", { bunchId, date }, token);
  },
};

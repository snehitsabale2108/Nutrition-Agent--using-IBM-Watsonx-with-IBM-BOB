/* ═══════════════════════════════════════════════════
   NutriBot — Frontend Application Logic
   IBM Watsonx AI Nutrition Agent
   ═══════════════════════════════════════════════════ */

"use strict";

// ─────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────
const state = {
  conversation:  [],          // full chat history
  familyMembers: [],          // family profiles
  userProfile:   {},          // current user profile
  recentFoods:   [],          // recently analysed foods
  theme:         "light",
};

// ─────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderFamilyMembers();
  updateDashboardStats();
  setupChatInputAutoResize();
  setupNavTabs();
  setupTheme();
  setupEnterToSend();
});

// ─────────────────────────────────────────────────────
//  PERSIST STATE
// ─────────────────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem("nutribot_profile",  JSON.stringify(state.userProfile));
    localStorage.setItem("nutribot_family",   JSON.stringify(state.familyMembers));
    localStorage.setItem("nutribot_recent",   JSON.stringify(state.recentFoods));
    localStorage.setItem("nutribot_theme",    state.theme);
    localStorage.setItem("nutribot_convo",    JSON.stringify(state.conversation.slice(-20)));
  } catch (_) {}
}

function loadState() {
  try {
    state.userProfile  = JSON.parse(localStorage.getItem("nutribot_profile")  || "{}");
    state.familyMembers= JSON.parse(localStorage.getItem("nutribot_family")   || "[]");
    state.recentFoods  = JSON.parse(localStorage.getItem("nutribot_recent")   || "[]");
    state.theme        = localStorage.getItem("nutribot_theme") || "light";
    state.conversation = JSON.parse(localStorage.getItem("nutribot_convo")    || "[]");
    applyProfileToForm();
    renderRecentAnalyses();
    updateFamilyCount();
    applyTheme(state.theme);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────
//  NAV TABS
// ─────────────────────────────────────────────────────
function setupNavTabs() {
  document.querySelectorAll(".nav-tab").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const tab = link.dataset.tab;
      if (tab) switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  // Hide all sections
  document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach(l => l.classList.remove("active"));

  // Show target section
  const section = document.getElementById(`tab-${tabId}`);
  const navLink  = document.querySelector(`[data-tab="${tabId}"]`);
  if (section) section.classList.add("active");
  if (navLink)  navLink.classList.add("active");

  // Hero only on dashboard
  const hero = document.getElementById("heroBanner");
  if (hero) hero.style.display = (tabId === "dashboard") ? "" : "none";

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─────────────────────────────────────────────────────
//  DARK MODE
// ─────────────────────────────────────────────────────
function setupTheme() {
  const btn = document.getElementById("themeToggle");
  if (btn) btn.addEventListener("click", toggleTheme);
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  applyTheme(state.theme);
  saveState();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.querySelector("#themeToggle i");
  if (icon) {
    icon.className = theme === "dark"
      ? "bi bi-sun-fill"
      : "bi bi-moon-stars-fill";
  }
}

// ─────────────────────────────────────────────────────
//  CHAT HELPERS
// ─────────────────────────────────────────────────────
function setupChatInputAutoResize() {
  const ta = document.getElementById("chatInput");
  if (!ta) return;
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  });
}

function setupEnterToSend() {
  const ta = document.getElementById("chatInput");
  if (!ta) return;
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  const qi = document.getElementById("quickChatInput");
  if (qi) qi.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); quickChat(); }
  });
}

function appendMessage(containerId, role, text) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isBot = role === "bot";
  const div = document.createElement("div");
  div.className = `msg ${isBot ? "bot-msg" : "user-msg"}`;

  const avatarHtml = isBot
    ? `<div class="avatar-sm"><i class="bi bi-robot"></i></div>`
    : "";

  div.innerHTML = `${avatarHtml}<div class="msg-bubble">${formatText(text)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const div = document.createElement("div");
  div.className = "msg bot-msg typing-wrap";
  div.id = "typingIndicator";
  div.innerHTML = `
    <div class="avatar-sm"><i class="bi bi-robot"></i></div>
    <div class="msg-bubble typing-indicator">
      <span></span><span></span><span></span>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

// ─────────────────────────────────────────────────────
//  TEXT FORMATTER (light markdown)
// ─────────────────────────────────────────────────────
function formatText(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm,   "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,    "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,     "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    // Bullet points
    .replace(/^[•\-\*] (.+)$/gm, "<li>$1</li>")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm,  "<li>$1</li>")
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    // Line breaks
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");

  return `<div class="output-content"><p>${html}</p></div>`;
}

function formatOutput(elementId, text) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `<div class="output-content">${markdownToHtml(text)}</div>`;
}

function markdownToHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm,   "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,    "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,     "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/^[•\-] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*?<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

// ─────────────────────────────────────────────────────
//  PROFILE HELPERS
// ─────────────────────────────────────────────────────
function getProfile() {
  return {
    name:     (document.getElementById("profName")?.value     || state.userProfile?.name     || ""),
    age:      (document.getElementById("profAge")?.value      || state.userProfile?.age      || ""),
    gender:   (document.getElementById("profGender")?.value   || state.userProfile?.gender   || "male"),
    weight:   (document.getElementById("profWeight")?.value   || state.userProfile?.weight   || ""),
    height:   (document.getElementById("profHeight")?.value   || state.userProfile?.height   || ""),
    goal:     (document.getElementById("profGoal")?.value     || state.userProfile?.goal     || ""),
    diet_type:(document.getElementById("profDiet")?.value     || state.userProfile?.diet_type|| "Vegetarian"),
    allergies:(document.getElementById("profAllergies")?.value|| state.userProfile?.allergies|| ""),
    medical:  (document.getElementById("profMedical")?.value  || state.userProfile?.medical  || ""),
    activity: (document.getElementById("profActivity")?.value || state.userProfile?.activity || "Moderate"),
  };
}

function applyProfileToForm() {
  const p = state.userProfile;
  if (!p || !Object.keys(p).length) return;
  setVal("profName",     p.name);
  setVal("profAge",      p.age);
  setVal("profGender",   p.gender);
  setVal("profWeight",   p.weight);
  setVal("profHeight",   p.height);
  setVal("profGoal",     p.goal);
  setVal("profDiet",     p.diet_type);
  setVal("profAllergies",p.allergies);
  setVal("profMedical",  p.medical);
  setVal("profActivity", p.activity);
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

function saveProfile() {
  state.userProfile = getProfile();
  saveState();
  const saved = document.getElementById("profileSaved");
  if (saved) { saved.style.display = "block"; setTimeout(() => saved.style.display = "none", 3000); }
  showToast("✅ Profile saved!");
  updateDashboardStats();
}

// ─────────────────────────────────────────────────────
//  DASHBOARD STATS
// ─────────────────────────────────────────────────────
function updateDashboardStats() {
  updateFamilyCount();
  const w = state.userProfile?.weight;
  const h = state.userProfile?.height;
  if (w && h) {
    const bmi = (parseFloat(w) / Math.pow(parseFloat(h) / 100, 2)).toFixed(1);
    setEl("dashBmi", bmi);
  }
}

function updateFamilyCount() {
  setEl("dashFamily", state.familyMembers.length);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─────────────────────────────────────────────────────
//  MAIN CHAT
// ─────────────────────────────────────────────────────
async function sendMessage() {
  const input   = document.getElementById("chatInput");
  const message = input?.value?.trim();
  if (!message) return;

  input.value = "";
  input.style.height = "auto";

  appendMessage("chatMessages", "user", message);
  state.conversation.push({ role: "user", content: message });

  appendTypingIndicator("chatMessages");
  toggleSendBtn(false);

  try {
    const res  = await postJSON("/api/chat", {
      message,
      profile:      getProfile(),
      conversation: state.conversation.slice(-8),
    });
    removeTypingIndicator();

    const reply = res.reply || "I'm having trouble responding right now. Please try again.";
    appendMessage("chatMessages", "bot", reply);
    state.conversation.push({ role: "bot", content: reply });
    saveState();
  } catch (err) {
    removeTypingIndicator();
    appendMessage("chatMessages", "bot", `⚠️ Error: ${err.message}. Please check your API credentials in the .env file.`);
  } finally {
    toggleSendBtn(true);
  }
}

function sendSuggestion(text) {
  const input = document.getElementById("chatInput");
  if (input) input.value = text;
  sendMessage();
}

function clearChat() {
  state.conversation = [];
  const container = document.getElementById("chatMessages");
  if (container) {
    container.innerHTML = `
      <div class="msg bot-msg">
        <div class="avatar-sm"><i class="bi bi-robot"></i></div>
        <div class="msg-bubble">Chat cleared! How can I help you with your nutrition today? 🥗</div>
      </div>`;
  }
  saveState();
}

function toggleSendBtn(enabled) {
  const btn = document.getElementById("sendBtn");
  if (btn) btn.disabled = !enabled;
}

// ─────────────────────────────────────────────────────
//  QUICK CHAT (Dashboard)
// ─────────────────────────────────────────────────────
async function quickChat() {
  const input   = document.getElementById("quickChatInput");
  const message = input?.value?.trim();
  if (!message) return;
  input.value = "";

  appendMessage("quickChatMessages", "user", message);
  appendTypingIndicator("quickChatMessages");

  try {
    const res = await postJSON("/api/chat", { message, profile: getProfile(), conversation: [] });
    removeTypingIndicator();
    appendMessage("quickChatMessages", "bot", res.reply || "...");
  } catch (err) {
    removeTypingIndicator();
    appendMessage("quickChatMessages", "bot", `⚠️ ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────
//  7-DAY MEAL PLAN
// ─────────────────────────────────────────────────────
async function generateMealPlan() {
  const profile = {
    ...getProfile(),
    goal:      document.getElementById("planGoal")?.value     || "maintenance",
    diet_type: document.getElementById("planDiet")?.value     || "vegetarian",
    calories:  document.getElementById("planCalories")?.value || 1800,
    cuisine:   document.getElementById("planCuisine")?.value  || "Indian",
    allergies: document.getElementById("planAllergies")?.value|| "",
  };

  showLoading("planOutput", "planLoading");
  const copyBtn = document.getElementById("copyPlanBtn");
  if (copyBtn) copyBtn.style.display = "none";

  try {
    const res = await postJSON("/api/nutrition-plan", { profile });
    hideLoading("planLoading");
    formatOutput("planOutput", res.plan || "No plan generated.");
    if (copyBtn) copyBtn.style.display = "inline-flex";
    showToast("✅ 7-day meal plan ready!");
  } catch (err) {
    hideLoading("planLoading");
    showError("planOutput", err.message);
  }
}

// ─────────────────────────────────────────────────────
//  QUICK MEAL SUGGESTION
// ─────────────────────────────────────────────────────
async function getMealSuggestion() {
  const mealType = document.getElementById("sgMealType")?.value || "lunch";
  const calories = document.getElementById("sgCalories")?.value || 400;
  const dietType = document.getElementById("planDiet")?.value   || "vegetarian";
  const cuisine  = document.getElementById("planCuisine")?.value|| "Indian";

  showLoading("planOutput", "planLoading");
  try {
    const res = await postJSON("/api/meal-suggestion", { meal_type: mealType, diet_type: dietType, calories, cuisine });
    hideLoading("planLoading");
    formatOutput("planOutput", res.suggestions || "No suggestions.");
    showToast(`🍽️ ${mealType} suggestions ready!`);
  } catch (err) {
    hideLoading("planLoading");
    showError("planOutput", err.message);
  }
}

// ─────────────────────────────────────────────────────
//  CALORIE ANALYSIS
// ─────────────────────────────────────────────────────
async function analyseCalories() {
  const food = document.getElementById("calorieInput")?.value?.trim();
  if (!food) { showToast("⚠️ Please enter a food or meal description.", "warn"); return; }

  showLoading("calorieOutput", "calorieLoading");

  try {
    const res = await postJSON("/api/calorie-analysis", { food });
    hideLoading("calorieLoading");
    formatOutput("calorieOutput", res.analysis || "No analysis available.");

    // Save to recent
    if (!state.recentFoods.includes(food)) {
      state.recentFoods.unshift(food);
      if (state.recentFoods.length > 5) state.recentFoods.pop();
      renderRecentAnalyses();
      saveState();
    }
    setEl("dashCalories", "Analysed");
    showToast("✅ Nutrition analysis complete!");
  } catch (err) {
    hideLoading("calorieLoading");
    showError("calorieOutput", err.message);
  }
}

function renderRecentAnalyses() {
  const container = document.getElementById("recentAnalyses");
  if (!container) return;
  if (!state.recentFoods.length) {
    container.innerHTML = `<small class="text-muted">No recent analyses yet.</small>`;
    return;
  }
  container.innerHTML = state.recentFoods.map(f =>
    `<div class="recent-item" onclick="reAnalyse('${f.replace(/'/g, "\\'")}')">
       <span>${f}</span><i class="bi bi-arrow-right-circle"></i>
     </div>`
  ).join("");
}

function reAnalyse(food) {
  const input = document.getElementById("calorieInput");
  if (input) input.value = food;
  analyseCalories();
}

// ─────────────────────────────────────────────────────
//  BMI CALCULATOR
// ─────────────────────────────────────────────────────
async function calculateBMI() {
  const weight = parseFloat(document.getElementById("bmiWeight")?.value);
  const height = parseFloat(document.getElementById("bmiHeight")?.value);
  const age    = parseInt(document.getElementById("bmiAge")?.value) || 25;
  const gender = document.getElementById("bmiGender")?.value || "male";

  if (!weight || !height || weight < 20 || height < 100) {
    showToast("⚠️ Please enter valid weight and height.", "warn"); return;
  }

  showLoading("bmiOutput", "bmiLoading");

  try {
    const res = await postJSON("/api/bmi", { weight, height, age, gender });
    hideLoading("bmiLoading");

    // Show gauge
    const bmi      = res.bmi;
    const category = res.category;
    document.getElementById("bmiGaugeWrap").style.display = "block";
    document.getElementById("bmiNumber").textContent = bmi;
    document.getElementById("bmiLabel").textContent  = category;

    // Colour the number
    const num = document.getElementById("bmiNumber");
    num.style.color = bmi < 18.5 ? "#3b82d4" : bmi < 25 ? "#22c55e" : bmi < 30 ? "#f59e0b" : "#ef4444";

    // Scale marker (0–40 BMI range mapped to 0–100%)
    const pct = Math.min(Math.max(((bmi - 10) / 30) * 100, 0), 100);
    document.getElementById("scaleFill").style.left = `${pct}%`;

    formatOutput("bmiOutput", res.advice || "");
    setEl("dashBmi", bmi);
    showToast(`✅ BMI: ${bmi} (${category})`);
  } catch (err) {
    hideLoading("bmiLoading");
    showError("bmiOutput", err.message);
  }
}

// ─────────────────────────────────────────────────────
//  FAMILY PLAN
// ─────────────────────────────────────────────────────
function addFamilyMember() {
  const form = document.getElementById("familyMemberForm");
  if (form) { form.style.display = "block"; document.getElementById("fmName")?.focus(); }
}

function cancelFamilyMember() {
  const form = document.getElementById("familyMemberForm");
  if (form) form.style.display = "none";
}

function saveFamilyMember() {
  const name    = document.getElementById("fmName")?.value?.trim();
  const age     = document.getElementById("fmAge")?.value;
  const gender  = document.getElementById("fmGender")?.value;
  const diet    = document.getElementById("fmDiet")?.value;
  const goal    = document.getElementById("fmGoal")?.value?.trim();
  const medical = document.getElementById("fmMedical")?.value?.trim();

  if (!name) { showToast("⚠️ Please enter a name.", "warn"); return; }

  state.familyMembers.push({ name, age, gender, diet, goal: goal || "Healthy eating", medical: medical || "None" });
  saveState();
  renderFamilyMembers();
  cancelFamilyMember();
  clearFamilyForm();
  showToast(`✅ ${name} added!`);
}

function clearFamilyForm() {
  ["fmName","fmAge","fmGoal","fmMedical"].forEach(id => setVal(id, ""));
}

function removeFamilyMember(index) {
  state.familyMembers.splice(index, 1);
  saveState();
  renderFamilyMembers();
  updateFamilyCount();
  showToast("🗑️ Member removed.");
}

function renderFamilyMembers() {
  const container = document.getElementById("familyMembersList");
  const genBtn    = document.getElementById("generateFamilyBtn");
  if (!container) return;

  if (!state.familyMembers.length) {
    container.innerHTML = `
      <div class="empty-state small-empty">
        <i class="bi bi-person-plus"></i>
        <p>Add family members to generate a shared nutrition plan.</p>
      </div>`;
    if (genBtn) genBtn.style.display = "none";
    return;
  }

  container.innerHTML = state.familyMembers.map((m, i) => `
    <div class="member-card">
      <div class="d-flex align-items-center gap-2">
        <div class="member-avatar"><i class="bi bi-person-fill"></i></div>
        <div class="member-info">
          <strong>${m.name}</strong>
          <small class="d-block">${m.age ? `Age ${m.age} · ` : ""}${m.gender} · ${m.diet}</small>
          <small class="text-muted">${m.goal}</small>
        </div>
      </div>
      <button class="btn btn-sm btn-outline-danger" onclick="removeFamilyMember(${i})"><i class="bi bi-trash3"></i></button>
    </div>`
  ).join("");

  if (genBtn) genBtn.style.display = "block";
  updateFamilyCount();
}

async function generateFamilyPlan() {
  if (!state.familyMembers.length) { showToast("⚠️ Add family members first.", "warn"); return; }

  showLoading("familyOutput", "familyLoading");
  try {
    const res = await postJSON("/api/family-plan", { members: state.familyMembers });
    hideLoading("familyLoading");
    formatOutput("familyOutput", res.family_plan || "No plan generated.");
    showToast("✅ Family nutrition plan ready!");
  } catch (err) {
    hideLoading("familyLoading");
    showError("familyOutput", err.message);
  }
}

// ─────────────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────────────
function showLoading(outputId, loadingId) {
  const out = document.getElementById(outputId);
  const ldr = document.getElementById(loadingId);
  if (out) out.innerHTML = "";
  if (ldr) ldr.style.display = "flex";
}

function hideLoading(loadingId) {
  const ldr = document.getElementById(loadingId);
  if (ldr) ldr.style.display = "none";
}

function showError(outputId, msg) {
  const el = document.getElementById(outputId);
  if (el) el.innerHTML = `
    <div class="alert alert-danger m-2" style="font-size:13.5px; border-radius:10px;">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      <strong>Error:</strong> ${escHtml(msg)}<br>
      <small class="text-muted mt-1 d-block">Please check your <code>.env</code> credentials and ensure IBM Watsonx.ai is configured correctly.</small>
    </div>`;
}

function showToast(message, type) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = type === "warn" ? "#d97706" : "";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 3000);
}

function copyToClipboard(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => showToast("📋 Copied to clipboard!"));
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ─────────────────────────────────────────────────────
//  API WRAPPER
// ─────────────────────────────────────────────────────
async function postJSON(url, body) {
  const response = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

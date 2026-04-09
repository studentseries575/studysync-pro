// ================================================================
//  script.js — StudySync Pro Dashboard v3.0
//  All features intact · Premium rendering · Calendar colors
// ================================================================

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, where, doc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Firebase ───────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBWGC1pTihEYMqiGrpNsiRYr9FNOXaJ37I",
  authDomain:        "studysync-ca148.firebaseapp.com",
  projectId:         "studysync-ca148",
  storageBucket:     "studysync-ca148.firebasestorage.app",
  messagingSenderId: "934842820293",
  appId:             "1:934842820293:web:e6e519beea7c560b47b2ac"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── App State ──────────────────────────────────────────────────
let tasks      = [];
let notes      = [];
let books      = [];
let pieChart   = null;
let barChart   = null;
let editId     = null;
let editNoteId = null;
let calYear    = new Date().getFullYear();
let calMonth   = new Date().getMonth();

let unsubTasks = null;
let unsubNotes = null;
let unsubBooks = null;

// ================================================================
//  AUTH GUARD
// ================================================================
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = "login.html"; return; }
  initDashboard(user);
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ================================================================
//  INIT
// ================================================================
function initDashboard(user) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning ☀️" : hour < 18 ? "Good Afternoon 🌤️" : "Good Evening 🌙";
  const displayName = localStorage.getItem("ss_displayName") || user.displayName || user.email.split("@")[0];

  setText("welcomeText", `${greeting}, ${displayName} 👋`);
  setText("welcomeSub",  "Ready to crush your goals today 🚀");

  updateProfileUI(displayName, user.email);
  loadQuote();
  updateClock(); setInterval(updateClock, 1000);

  // Dark mode
  if (localStorage.getItem("ss_darkMode") === "true") {
    document.body.classList.add("dark");
    const tog = document.getElementById("darkToggle");
    if (tog) tog.checked = true;
  }

  // Avatar color
  const color = localStorage.getItem("ss_avatarColor");
  if (color) applyAvatarColor(color);

  // Firestore
  subscribeToTasks(user.uid);
  subscribeToNotes(user.uid);
  subscribeToBooks(user.uid);

  renderCalendar();
}

function updateProfileUI(name, email) {
  const letter = name.charAt(0).toUpperCase();
  ["topAvatar", "sidebarAvatar", "ppAvatar"].forEach(id => setText(id, letter));
  setText("topName",     name);
  setText("sidebarName", name);
  setText("ppName",      name);
  setText("ppEmail",     email);
}

// ================================================================
//  FIRESTORE SUBSCRIPTIONS
// ================================================================
function subscribeToTasks(uid) {
  if (unsubTasks) unsubTasks();
  const q = query(collection(db, "tasks"), where("uid", "==", uid));
  unsubTasks = onSnapshot(q, snap => {
    tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    displayTasks();
    displayRecentTasks();
    updateStats();
    renderCharts();
    renderNotifications();
    renderCalendar();
    updateNavPips();
  });
}

function subscribeToNotes(uid) {
  if (unsubNotes) unsubNotes();
  const q = query(collection(db, "notes"), where("uid", "==", uid));
  unsubNotes = onSnapshot(q, snap => {
    notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    displayNotes();
  });
}

function subscribeToBooks(uid) {
  if (unsubBooks) unsubBooks();
  const q = query(collection(db, "books"), where("uid", "==", uid));
  unsubBooks = onSnapshot(q, snap => {
    books = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    displayBooks();
  });
}

// ================================================================
//  NAV PIPS (overdue badge on sidebar Tasks item)
// ================================================================
function updateNavPips() {
  const today   = todayStr();
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && !t.completed).length;
  const pip     = document.getElementById("pip-tasksPage");
  if (pip) {
    if (overdue > 0) {
      pip.textContent = overdue; pip.classList.add("show");
    } else {
      pip.classList.remove("show");
    }
  }
}

// ================================================================
//  TASKS — CRUD
// ================================================================
document.getElementById("addTaskBtn")?.addEventListener("click", addTask);
document.getElementById("taskInput")?.addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });

async function addTask() {
  const user = auth.currentUser; if (!user) return;
  const text     = val("taskInput").trim();
  const priority = val("priority");
  const dueDate  = val("dueDate");
  const category = val("category") || "General";
  const note     = val("taskNote").trim();

  if (!text) return toast("Please enter a task name.", "error");

  try {
    await addDoc(collection(db, "tasks"), {
      text, priority, dueDate, category, note,
      completed: false, uid: user.uid, createdAt: serverTimestamp()
    });
    clearField("taskInput"); clearField("taskNote");
    document.getElementById("dueDate").value = "";
    toast("Task added! ✅", "success");
  } catch (err) {
    console.error(err);
    toast("Failed to add task.", "error");
  }
}

function displayTasks(list) {
  const container = document.getElementById("taskList");
  if (!container) return;
  const items = list ?? getFilteredTasks();
  container.innerHTML = items.length ? items.map(taskHTML).join("") : emptyStateSVG("tasks");
}

function displayRecentTasks() {
  const container = document.getElementById("recentTaskList");
  if (!container) return;
  const recent = tasks.slice(0, 5);
  container.innerHTML = recent.length ? recent.map(taskHTML).join("") : emptyStateSVG("tasks");
}

function getFilteredTasks() {
  const status   = val("filterStatus")   || "all";
  const priority = val("filterPriority") || "all";
  const search   = val("searchTask").toLowerCase();
  const today    = todayStr();

  return tasks.filter(t => {
    const matchStatus =
      status === "all"       ? true :
      status === "completed" ? t.completed :
      status === "pending"   ? !t.completed && (!t.dueDate || t.dueDate >= today) :
      status === "overdue"   ? (t.dueDate && t.dueDate < today && !t.completed) : true;

    const matchPriority = priority === "all" || t.priority === priority;
    const matchSearch   = !search || t.text?.toLowerCase().includes(search);
    return matchStatus && matchPriority && matchSearch;
  });
}

window.filterTasks = () => displayTasks();

function taskHTML(task) {
  const today    = todayStr();
  const isOverdue = task.dueDate && task.dueDate < today && !task.completed;
  const priClass  = (task.priority || "").toLowerCase();

  return `<div class="task-item ${task.completed ? "completed" : ""} ${isOverdue ? "overdue" : ""}" data-id="${task.id}">
    <div class="task-check ${task.completed ? "done" : ""}" onclick="toggleTask('${task.id}')">
      ${task.completed ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ""}
    </div>
    <div class="task-body">
      <div class="task-title">${escHtml(task.text)}</div>
      <div class="task-meta">
        ${task.priority ? `<span class="badge ${priClass}">${task.priority}</span>` : ""}
        ${task.category ? `<span class="task-meta-chip">📁 ${escHtml(task.category)}</span>` : ""}
        ${task.dueDate  ? `<span class="task-meta-chip ${isOverdue ? "overdue-chip" : ""}">📅 ${formatDate(task.dueDate)}</span>` : ""}
      </div>
    </div>
    <div class="task-actions">
      <button class="task-act-btn edit"   onclick="openEdit('${task.id}')" title="Edit">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="task-act-btn delete" onclick="deleteTask('${task.id}')" title="Delete">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      </button>
    </div>
  </div>`;
}

window.toggleTask = async function(id) {
  const task = tasks.find(t => t.id === id); if (!task) return;
  try { await updateDoc(doc(db, "tasks", id), { completed: !task.completed }); }
  catch (e) { toast("Failed to update.", "error"); }
};

window.deleteTask = async function(id) {
  if (!confirm("Delete this task?")) return;
  try { await deleteDoc(doc(db, "tasks", id)); toast("Task deleted.", "info"); }
  catch (e) { toast("Failed to delete.", "error"); }
};

window.openEdit = function(id) {
  const task = tasks.find(t => t.id === id); if (!task) return;
  editId = id;
  setVal("editText",     task.text);
  setVal("editPriority", task.priority || "Medium");
  setVal("editCategory", task.category || "General");
  setVal("editDate",     task.dueDate  || "");
  openModal("editModal");
};

window.saveEdit = async function() {
  if (!editId) return;
  const text = val("editText").trim();
  if (!text) return toast("Task name can't be empty.", "error");
  try {
    await updateDoc(doc(db, "tasks", editId), {
      text, priority: val("editPriority"), category: val("editCategory"), dueDate: val("editDate")
    });
    closeModal("editModal"); toast("Task updated! ✏️", "success"); editId = null;
  } catch (e) { toast("Failed to save.", "error"); }
};

window.clearTasks = async function() {
  if (!confirm("Delete ALL tasks? This cannot be undone.")) return;
  try {
    await Promise.all(tasks.map(t => deleteDoc(doc(db, "tasks", t.id))));
    toast("All tasks cleared.", "info");
  } catch (e) { toast("Failed.", "error"); }
};

// ================================================================
//  STATS
// ================================================================
function updateStats() {
  const today     = todayStr();
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending   = tasks.filter(t => !t.completed).length;
  const overdue   = tasks.filter(t => t.dueDate && t.dueDate < today && !t.completed).length;

  setText("totalTasks",     total);
  setText("completedTasks", completed);
  setText("pendingTasks",   pending);
  setText("overdueTasks",   overdue);

  const pct = total ? Math.round((completed / total) * 100) : 0;
  setText("percentText",  pct + "%");
  setText("donutLabel",   pct + "%");
}

// ================================================================
//  CHARTS
// ================================================================
function renderCharts() { renderPieChart(); renderBarChart(); }

function renderPieChart() {
  const canvas = document.getElementById("pieChart"); if (!canvas) return;
  const done    = tasks.filter(t => t.completed).length;
  const pending = tasks.length - done;
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending"],
      datasets: [{
        data: [done, pending || (done === 0 ? 1 : 0)],
        backgroundColor: done === 0 && pending === 0
          ? ["#e2e8f0", "#e2e8f0"]
          : ["#6366f1", "#e2e8f0"],
        borderWidth: 0, hoverOffset: 8
      }]
    },
    options: {
      cutout: "78%",
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` }
      }},
      animation: { duration: 700, easing: "easeInOutCubic" }
    }
  });
}

function renderBarChart() {
  const canvas = document.getElementById("barChart"); if (!canvas) return;
  const cats  = ["Study","Assignment","Quiz","Project","Personal","General"];
  const data  = cats.map(c => tasks.filter(t => t.category === c).length);
  const colors = cats.map((_, i) => [
    "rgba(99,102,241,0.75)", "rgba(124,58,237,0.75)", "rgba(14,165,233,0.75)",
    "rgba(16,185,129,0.75)", "rgba(245,158,11,0.75)", "rgba(148,163,184,0.65)"
  ][i]);

  if (barChart) barChart.destroy();
  barChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: cats,
      datasets: [{
        label: "Tasks",
        data, backgroundColor: colors,
        borderRadius: 6, borderSkipped: false,
        hoverBackgroundColor: colors.map(c => c.replace("0.75","1").replace("0.65","1"))
      }]
    },
    options: {
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${ctx.parsed.y} task${ctx.parsed.y !== 1 ? "s" : ""}` }
      }},
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, color: "#94a3b8", font: { size: 11 } },
             grid: { color: "rgba(148,163,184,0.1)" }, border: { display: false } },
        x: { ticks: { color: "#94a3b8", font: { size: 11 } },
             grid: { display: false }, border: { display: false } }
      },
      animation: { duration: 700 }
    }
  });
}

// ================================================================
//  NOTIFICATIONS
// ================================================================
function renderNotifications() {
  const today    = todayStr();
  const dueTasks = tasks.filter(t => t.dueDate === today && !t.completed);
  const overdue  = tasks.filter(t => t.dueDate && t.dueDate < today && !t.completed);
  const all      = [...dueTasks, ...overdue];

  // Dot on bell
  const dot = document.getElementById("notifDot");
  if (dot) dot.style.display = all.length ? "block" : "none";

  // Count badge in panel
  setText("notifPanelCount", all.length);

  const list = document.getElementById("notifList");
  if (!list) return;

  if (!all.length) {
    list.innerHTML = `<div class="panel-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" style="color:var(--muted)"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <p>You're all caught up!</p>
    </div>`;
    return;
  }

  list.innerHTML = [
    ...dueTasks.map(t => `
      <div class="notif-list-item">
        <div class="notif-dot-tag" style="background:#f59e0b"></div>
        <div><strong>Due today</strong><br>${escHtml(t.text)}</div>
      </div>`),
    ...overdue.map(t => `
      <div class="notif-list-item">
        <div class="notif-dot-tag" style="background:#ef4444"></div>
        <div><strong>Overdue</strong><br>${escHtml(t.text)}</div>
      </div>`)
  ].join("");

  // Browser notification (once per session)
  if (dueTasks.length && !sessionStorage.getItem("ss_notifShown")) {
    sessionStorage.setItem("ss_notifShown", "1");
    if (Notification.permission === "granted") {
      dueTasks.forEach(t => new Notification("StudySync: Task Due Today!", { body: t.text }));
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        if (p === "granted")
          dueTasks.forEach(t => new Notification("StudySync: Task Due Today!", { body: t.text }));
      });
    }
  }
}

window.toggleNotif = function(e) {
  e.stopPropagation();
  const panel = document.getElementById("notifPanel");
  panel?.classList.toggle("open");
  document.getElementById("profilePanel")?.classList.remove("open");
};

// ================================================================
//  NOTES
// ================================================================
window.openNoteModal = function(id) {
  editNoteId = id || null;
  const title = document.getElementById("noteModalTitle");
  if (id) {
    const note = notes.find(n => n.id === id); if (!note) return;
    if (title) title.textContent = "Edit Note";
    setVal("noteTitle",   note.title);
    setVal("noteContent", note.content);
    setVal("noteTag",     note.tag);
  } else {
    if (title) title.textContent = "New Note";
    clearField("noteTitle"); clearField("noteContent");
    setVal("noteTag", "General");
  }
  openModal("noteModal");
};

window.saveNote = async function() {
  const user = auth.currentUser; if (!user) return;
  const title   = val("noteTitle").trim();
  const content = val("noteContent").trim();
  const tag     = val("noteTag");
  if (!title) return toast("Note title is required.", "error");

  try {
    if (editNoteId) {
      await updateDoc(doc(db, "notes", editNoteId), { title, content, tag });
      toast("Note updated! 📝", "success");
    } else {
      await addDoc(collection(db, "notes"), {
        title, content, tag, uid: user.uid, createdAt: serverTimestamp()
      });
      toast("Note saved! 📝", "success");
    }
    closeModal("noteModal"); editNoteId = null;
  } catch (e) { toast("Failed to save note.", "error"); }
};

window.deleteNote = async function(id, e) {
  e.stopPropagation();
  if (!confirm("Delete this note?")) return;
  try { await deleteDoc(doc(db, "notes", id)); toast("Note deleted.", "info"); }
  catch (e) { toast("Failed to delete.", "error"); }
};

window.clearNotes = async function() {
  if (!confirm("Delete ALL notes?")) return;
  try {
    await Promise.all(notes.map(n => deleteDoc(doc(db, "notes", n.id))));
    toast("All notes cleared.", "info");
  } catch (e) { toast("Failed.", "error"); }
};

function displayNotes() {
  const container = document.getElementById("notesList"); if (!container) return;
  if (!notes.length) {
    container.innerHTML = `<div style="grid-column:1/-1">${emptyStateSVG("notes")}</div>`;
    return;
  }
  container.innerHTML = notes.map(n => `
    <div class="note-card" data-tag="${escHtml(n.tag || "General")}" onclick="openNoteModal('${n.id}')">
      <div class="note-card-top">
        <div class="note-card-title">${escHtml(n.title)}</div>
        <span class="note-tag-badge">${escHtml(n.tag || "General")}</span>
      </div>
      <div class="note-body">${escHtml(n.content || "No content.")}</div>
      <div class="note-footer">
        <span class="note-date">${formatTs(n.createdAt)}</span>
        <button class="note-delete-btn" onclick="deleteNote('${n.id}', event)" title="Delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`).join("");
}

// ================================================================
//  BOOKS
// ================================================================
window.addBook = async function() {
  const user = auth.currentUser; if (!user) return;
  const name     = val("bookName").trim();
  const author   = val("bookAuthor").trim();
  const progress = parseInt(val("bookProgress")) || 0;
  const status   = val("bookStatus") || "Reading";
  if (!name) return toast("Enter a book title.", "error");

  try {
    await addDoc(collection(db, "books"), {
      name, author, progress, status, uid: user.uid, createdAt: serverTimestamp()
    });
    clearField("bookName"); clearField("bookAuthor");
    document.getElementById("bookProgress").value = 0;
    document.getElementById("progressLabel").textContent = "0";
    toast("Book added! 📖", "success");
  } catch (e) { toast("Failed to add book.", "error"); }
};

window.deleteBook = async function(id, e) {
  e.stopPropagation();
  if (!confirm("Remove this book?")) return;
  try { await deleteDoc(doc(db, "books", id)); toast("Book removed.", "info"); }
  catch (e) { toast("Failed.", "error"); }
};

function displayBooks() {
  const container = document.getElementById("bookList"); if (!container) return;
  if (!books.length) {
    container.innerHTML = emptyStateSVG("books");
    return;
  }
  container.innerHTML = books.map(b => `
    <div class="book-item">
      <div class="book-spine">${bookEmoji(b.status)}</div>
      <div class="book-info">
        <div class="book-title">${escHtml(b.name)}</div>
        ${b.author ? `<div class="book-author">by ${escHtml(b.author)}</div>` : ""}
        <div class="book-progress-track">
          <div class="book-progress-fill" style="width:${b.progress || 0}%"></div>
        </div>
        <div class="book-pct">${b.progress || 0}% complete</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
        <span class="book-status-tag">${escHtml(b.status || "Reading")}</span>
        <button class="task-act-btn delete" onclick="deleteBook('${b.id}', event)" title="Remove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`).join("");
}

function bookEmoji(status) {
  return { Reading: "📖", Completed: "✅", Wishlist: "🔖", Paused: "⏸" }[status] || "📖";
}

// ================================================================
//  CALENDAR — with color-coded dots
// ================================================================
window.changeMonth = function(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth <  0) { calMonth = 11; calYear--; }
  renderCalendar();
};

window.goToToday = function() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
};

function renderCalendar() {
  const label = document.getElementById("calMonthLabel");
  const grid  = document.getElementById("calendarGrid");
  if (!grid) return;

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (label) label.textContent = `${MONTHS[calMonth]} ${calYear}`;

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const now         = new Date();
  const isCurrentMonth = now.getFullYear() === calYear && now.getMonth() === calMonth;
  const today       = todayStr();

  let html = "";

  // Empty cells before month starts
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr   = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isToday   = isCurrentMonth && d === now.getDate();
    const dayTasks  = tasks.filter(t => t.dueDate === dateStr);

    // Build dot indicators (up to 3)
    let dotHtml = "";
    if (dayTasks.length) {
      const completed = dayTasks.filter(t => t.completed);
      const overdue   = dayTasks.filter(t => !t.completed && t.dueDate < today);
      const pending   = dayTasks.filter(t => !t.completed && t.dueDate >= today);

      const dots = [];
      if (completed.length) dots.push(`<div class="cal-day-dot" style="background:#6366f1" title="${completed.length} completed"></div>`);
      if (pending.length)   dots.push(`<div class="cal-day-dot" style="background:#f59e0b" title="${pending.length} pending"></div>`);
      if (overdue.length)   dots.push(`<div class="cal-day-dot" style="background:#ef4444" title="${overdue.length} overdue"></div>`);
      dotHtml = `<div class="cal-day-dots">${dots.slice(0,3).join("")}</div>`;
    }

    html += `<div class="cal-day ${isToday ? "today" : ""}"
      onclick="selectCalDay('${dateStr}', this)">
      ${d}${dotHtml}
    </div>`;
  }

  grid.innerHTML = html;
}

window.selectCalDay = function(dateStr, el) {
  document.querySelectorAll(".cal-day").forEach(d => d.classList.remove("selected"));
  el.classList.add("selected");

  const panel = document.getElementById("calTasksPanel");
  const label = document.getElementById("calTasksDate");
  const list  = document.getElementById("calendarTasks");
  if (!panel || !list) return;

  const dayTasks = tasks.filter(t => t.dueDate === dateStr);
  if (label) label.textContent = `Tasks for ${formatDate(dateStr)}`;
  list.innerHTML = dayTasks.length
    ? dayTasks.map(taskHTML).join("")
    : `<p style="padding:14px;color:var(--muted);font-size:14px">No tasks scheduled for this day.</p>`;

  panel.style.display = "block";
};

// ================================================================
//  GLOBAL SEARCH
// ================================================================
document.getElementById("globalSearch")?.addEventListener("input", function() {
  const q   = this.value.trim().toLowerCase();
  const box = document.getElementById("searchResults");
  if (!box) return;
  if (!q) { box.classList.remove("show"); return; }

  const results = [
    ...tasks.filter(t => t.text?.toLowerCase().includes(q)).slice(0,4)
              .map(t => ({ icon: "✅", label: t.text, type: "Task",  page: "tasksPage" })),
    ...notes.filter(n => n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)).slice(0,3)
              .map(n => ({ icon: "📝", label: n.title, type: "Note",  page: "notesPage" })),
    ...books.filter(b => b.name?.toLowerCase().includes(q)).slice(0,2)
              .map(b => ({ icon: "📖", label: b.name,  type: "Book",  page: "booksPage" }))
  ];

  if (!results.length) {
    box.innerHTML = `<div class="search-no-results">No results for "<strong>${escHtml(q)}</strong>"</div>`;
  } else {
    box.innerHTML = results.map(r =>
      `<div class="search-result-item" onclick="goToSearchResult('${r.page}')">
        <span>${r.icon}</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.label)}</span>
        <span class="search-result-type">${r.type}</span>
      </div>`).join("");
  }
  box.classList.add("show");
});

window.goToSearchResult = function(page) {
  showPage(page, document.querySelector(`[onclick*="${page}"]`));
  document.getElementById("searchResults")?.classList.remove("show");
  document.getElementById("globalSearch").value = "";
};

document.addEventListener("click", e => {
  const box = document.getElementById("searchResults");
  const inp = document.getElementById("globalSearch");
  if (box && inp && !inp.closest(".search-wrap")?.contains(e.target)) box.classList.remove("show");
});

// ================================================================
//  SIDEBAR & NAVIGATION
// ================================================================
window.showPage = function(pageId, navEl) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (navEl) {
    navEl.classList.add("active");
  } else {
    document.querySelector(`[onclick*="${pageId}"]`)?.classList.add("active");
  }
  if (window.innerWidth <= 768) closeSidebar();
};

window.toggleSidebar = function() {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("sidebarOverlay")?.classList.toggle("open");
};

window.closeSidebar = function() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("open");
};

// ================================================================
//  PROFILE
// ================================================================
window.toggleProfile = function(e) {
  e.stopPropagation();
  const panel = document.getElementById("profilePanel");
  panel?.classList.toggle("open");
  document.getElementById("notifPanel")?.classList.remove("open");
};

window.openProfileModal = function() {
  const user = auth.currentUser; if (!user) return;
  setVal("profileName",  localStorage.getItem("ss_displayName") || user.email.split("@")[0]);
  setVal("profileAbout", localStorage.getItem("ss_about") || "");
  setVal("profileColor", localStorage.getItem("ss_avatarColor") || "#6366f1");
  openModal("profileModal");
  document.getElementById("profilePanel")?.classList.remove("open");
};

window.saveProfile = function() {
  const name  = val("profileName").trim()  || auth.currentUser?.email.split("@")[0];
  const about = val("profileAbout").trim();
  const color = val("profileColor");

  localStorage.setItem("ss_displayName", name);
  localStorage.setItem("ss_about",       about);
  localStorage.setItem("ss_avatarColor", color);

  updateProfileUI(name, auth.currentUser?.email || "");
  applyAvatarColor(color);
  closeModal("profileModal");
  toast("Profile updated! 👤", "success");
};

function applyAvatarColor(color) {
  ["topAvatar", "sidebarAvatar", "ppAvatar"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.background = color;
  });
}

// ================================================================
//  DARK MODE
// ================================================================
window.toggleDark = function() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("ss_darkMode", isDark);
  const tog = document.getElementById("darkToggle");
  if (tog) tog.checked = isDark;
};

// ================================================================
//  MODALS
// ================================================================
window.openModal  = id => { document.getElementById(id)?.classList.add("open"); };
window.closeModal = id => { document.getElementById(id)?.classList.remove("open"); };
window.handleModalOverlayClick = (e, id) => { if (e.target === e.currentTarget) closeModal(id); };

// Close dropdowns on outside click
document.addEventListener("click", () => {
  document.getElementById("notifPanel")?.classList.remove("open");
  document.getElementById("profilePanel")?.classList.remove("open");
});
["notifPanel","profilePanel"].forEach(id => {
  document.getElementById(id)?.addEventListener("click", e => e.stopPropagation());
});

// ================================================================
//  CLOCK & QUOTES
// ================================================================
function updateClock() {
  const el = document.getElementById("clock"); if (!el) return;
  el.textContent = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

const QUOTES = [
  "Push yourself, because no one else will 💪",
  "Success starts with self-discipline 🚀",
  "Small progress is still progress 📈",
  "Stay focused and never give up 🔥",
  "Your future depends on what you do today ✨",
  "Consistency beats motivation every time 🎯",
  "One task at a time. That's enough 🧘",
  "Believe in your ability to figure things out 🌟",
  "Every expert was once a beginner 📚",
  "You don't have to be perfect to start 🌱"
];
function loadQuote() {
  const el = document.getElementById("quoteBox"); if (!el) return;
  el.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

// ================================================================
//  TOAST
// ================================================================
let _toastTimer = null;
window.toast = function(msg, type = "info") {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = "toast"; }, 3200);
};

// ================================================================
//  EMPTY STATES (inline SVG illustrations)
// ================================================================
function emptyStateSVG(type) {
  const svgs = {
    tasks: `<svg class="empty-state-svg" width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="14" width="48" height="52" rx="6" fill="currentColor" opacity="0.06"/>
      <rect x="24" y="26" width="22" height="4" rx="2" fill="currentColor" opacity="0.25"/>
      <rect x="24" y="35" width="32" height="4" rx="2" fill="currentColor" opacity="0.18"/>
      <rect x="24" y="44" width="28" height="4" rx="2" fill="currentColor" opacity="0.18"/>
      <circle cx="58" cy="56" r="14" fill="#6366f1" opacity="0.15"/>
      <path d="M53 56l3 3 6-6" stroke="#6366f1" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    </svg>`,
    notes: `<svg class="empty-state-svg" width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="16" width="42" height="52" rx="5" fill="currentColor" opacity="0.07"/>
      <rect x="12" y="16" width="42" height="52" rx="5" stroke="currentColor" stroke-opacity="0.15" stroke-width="1.5"/>
      <rect x="22" y="29" width="24" height="3.5" rx="1.75" fill="currentColor" opacity="0.3"/>
      <rect x="22" y="38" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.18"/>
      <rect x="22" y="46" width="26" height="3" rx="1.5" fill="currentColor" opacity="0.18"/>
      <circle cx="58" cy="22" r="10" fill="#f59e0b" opacity="0.2"/>
      <path d="M55 22h6M58 19v6" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    </svg>`,
    books: `<svg class="empty-state-svg" width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="14" width="28" height="42" rx="4" fill="#6366f1" opacity="0.12"/>
      <rect x="18" y="14" width="28" height="42" rx="4" stroke="#6366f1" stroke-opacity="0.3" stroke-width="1.5"/>
      <rect x="34" y="14" width="28" height="42" rx="4" fill="currentColor" opacity="0.06"/>
      <rect x="34" y="14" width="28" height="42" rx="4" stroke="currentColor" stroke-opacity="0.12" stroke-width="1.5"/>
      <rect x="23" y="24" width="16" height="2.5" rx="1.25" fill="#6366f1" opacity="0.5"/>
      <rect x="23" y="31" width="20" height="2" rx="1" fill="#6366f1" opacity="0.3"/>
    </svg>`
  };
  return `<div class="empty-state">
    ${svgs[type] || svgs.tasks}
    <p>Nothing here yet — add your first item!</p>
  </div>`;
}

// ================================================================
//  HELPERS
// ================================================================
const val       = id => document.getElementById(id)?.value ?? "";
const setVal    = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
const setText   = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
const clearField= id => setVal(id, "");
const todayStr  = () => new Date().toISOString().split("T")[0];
const escHtml   = str => String(str ?? "")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function formatDate(str) {
  if (!str) return "—";
  try { return new Date(str + "T00:00:00").toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }); }
  catch { return str; }
}
function formatTs(ts) {
  if (!ts?.seconds) return "Just now";
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
}

/**
 * ===================================================================
 * NEXA - AI Daily Assistant
 * Category: AI Integrated Website | Theme: AI for Daily Life
 * ===================================================================
 */

// KONFIGURASI GEMINI API
// Masukkan Google Gemini API Key Anda di bawah ini jika ingin menggunakan live API.
// Jika dibiarkan default, NEXA akan otomatis menggunakan Autonomous Smart Offline Engine.
const GEMINI_API_KEY = "";
const GEMINI_MODEL = "gemini-3-flash-preview";

// System Prompt NEXA untuk Gemini API
const NEXA_SYSTEM_PROMPT = `
Kamu adalah NEXA, AI Daily Assistant.
Tugasmu adalah membantu pengguna mengatur kegiatan sehari-hari berdasarkan tujuan, tugas, deadline, waktu yang tersedia, tingkat kepentingan, dan kondisi fisik/mental pengguna.

Jawab SELALU dalam format JSON yang valid, tanpa teks pengantar atau penutup di luar JSON.
Gunakan Bahasa Indonesia yang jelas, singkat, ramah, dan solutif.

Analisis situasi pengguna dan buat jadwal kegiatan yang realistis.
Prioritaskan tugas berdasarkan:
1. Deadline terdekat
2. Tingkat kepentingan (HIGH > MEDIUM > LOW)
3. Estimasi waktu & alokasi jeda/istirahat (break) yang realistis
4. Waktu yang tersedia dan constraint/batasan pengguna
5. Kondisi energi pengguna (jika lelah, berikan waktu lebih fleksibel atau jeda)

Format JSON yang HARUS kamu hasilkan:
{
  "summary": "Ringkasan tujuan utama hari ini (1 kalimat)",
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "totalTime": 120, // total durasi menit
  "recommendation": "Saran strategis singkat untuk menyelesaikan target",
  "reasoning": "Alasan mengapa urutan prioritas ini dipilih (Deadline terdekat, energi, dll)",
  "tasks": [
    {
      "title": "Nama tugas",
      "duration": 30,
      "priority": "HIGH",
      "reason": "Alasan penempatan"
    }
  ],
  "schedule": [
    {
      "start": "16:30",
      "end": "17:00",
      "title": "Review Materi & Konsep",
      "type": "STUDY" | "PRACTICE" | "BREAK" | "TASK" | "REVIEW",
      "duration": 30,
      "priority": "HIGH",
      "tips": "Fokus pada materi penting"
    }
  ],
  "changes": {
    "isAdapted": false,
    "beforeTime": "",
    "nowTime": "",
    "removed": [],
    "prioritized": [],
    "advice": ""
  }
}
`;

// ===================================================================
// DATA MODEL & STATE MANAGEMENT
// ===================================================================
const STORAGE_KEYS = {
  TASKS: "nexa_tasks_data",
  CURRENT_PLAN: "nexa_current_plan"
};

// Default Realistic Demo Tasks
const DEFAULT_DEMO_TASKS = [
  {
    id: "task-001",
    title: "Belajar Matematika",
    description: "Latihan persamaan kuadrat bab 3 untuk persiapan ujian",
    deadline: getRelativeDate(1), // Besok
    duration: 90,
    priority: "HIGH",
    category: "STUDY",
    notes: "Saya masih belum memahami materi persamaan kuadrat, butuh review rumus dulu.",
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: "task-002",
    title: "Mengerjakan Tugas Bahasa Indonesia",
    description: "Membuat draft esai deskriptif tentang teknologi masa depan",
    deadline: getRelativeDate(3), // 3 hari lagi
    duration: 45,
    priority: "MEDIUM",
    category: "STUDY",
    notes: "Minimal 500 kata, sudah ada outline garis besar.",
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: "task-003",
    title: "Project Coding Website",
    description: "Implementasi fitur responsif dan integrasi komponen UI",
    deadline: getRelativeDate(5), // 5 hari lagi
    duration: 120,
    priority: "MEDIUM",
    category: "PROJECT",
    notes: "Proyek pengembangan website asisten harian.",
    completed: false,
    createdAt: new Date().toISOString()
  }
];

// Default Realistic Initial Schedule
const DEFAULT_INITIAL_PLAN = {
  summary: "Persiapan Ujian Matematika & Tugas Harian",
  priority: "HIGH",
  totalTime: 150,
  recommendation: "Fokus utama pada matematika karena ujian berlangsung besok. Mulai dengan review materi ringan lalu intensif latihan soal.",
  reasoning: "Ujian Matematika memiliki deadline besok pagi (urgensi tertinggi), sedangkan tugas esai memiliki deadline 3 hari ke depan sehingga dijadwalkan setelah sesi utama.",
  schedule: [
    {
      id: "sch-1",
      start: "16:30",
      end: "17:00",
      title: "📚 Review Materi & Rumus Matematika",
      type: "STUDY",
      duration: 30,
      priority: "HIGH",
      tips: "Baca kembali catatan rumus persamaan kuadrat & diskriminan.",
      completed: false
    },
    {
      id: "sch-2",
      start: "17:00",
      end: "17:40",
      title: "🧠 Latihan Soal Ujian Matematika",
      type: "PRACTICE",
      duration: 40,
      priority: "HIGH",
      tips: "Kerjakan 5-8 variasi soal tipe sulit.",
      completed: false
    },
    {
      id: "sch-3",
      start: "17:40",
      end: "17:55",
      title: "☕ Istirahat & Relaksasi (Break)",
      type: "BREAK",
      duration: 15,
      priority: "LOW",
      tips: "Minum air putih, stretching ringan, jauhkan layar sejenak.",
      completed: false
    },
    {
      id: "sch-4",
      start: "17:55",
      end: "18:40",
      title: "🎯 Fokus Materi yang Belum Dikuasai",
      type: "STUDY",
      duration: 45,
      priority: "HIGH",
      tips: "Ulangi nomor-nomor soal yang salah saat latihan tadi.",
      completed: false
    },
    {
      id: "sch-5",
      start: "18:40",
      end: "19:00",
      title: "📝 Quick Review & Rangkuman Singkat",
      type: "REVIEW",
      duration: 20,
      priority: "HIGH",
      tips: "Pastikan semua formula penting sudah dihafal sebelum acara jam 19:00.",
      completed: false
    }
  ],
  changes: null
};

// Global App State
let appState = {
  tasks: [],
  currentPlan: null,
  currentFilter: "all",
  searchQuery: "",
  editingTaskId: null
};

// Helper: Format relative ISO date YYYY-MM-DD
function getRelativeDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

// ===================================================================
// INITIALIZATION
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

function initializeApp() {
  loadData();
  setupDateDisplay();
  setupNavigation();
  setupModals();
  setupTaskCRUD();
  setupPlannerEvents();
  setupAdaptiveControls();
  setupChatHub();

  // Initial renders
  renderDashboard();
  renderTasks();
  renderSchedule();
  renderProgress();
}

// ===================================================================
// STORAGE & DATA LOAD/SAVE
// ===================================================================
function loadData() {
  try {
    const storedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    appState.tasks = storedTasks ? JSON.parse(storedTasks) : [...DEFAULT_DEMO_TASKS];

    const storedPlan = localStorage.getItem(STORAGE_KEYS.CURRENT_PLAN);
    appState.currentPlan = storedPlan ? JSON.parse(storedPlan) : JSON.parse(JSON.stringify(DEFAULT_INITIAL_PLAN));
  } catch (error) {
    console.error("Gagal memuat data dari LocalStorage:", error);
    appState.tasks = [...DEFAULT_DEMO_TASKS];
    appState.currentPlan = JSON.parse(JSON.stringify(DEFAULT_INITIAL_PLAN));
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(appState.tasks));
    localStorage.setItem(STORAGE_KEYS.CURRENT_PLAN, JSON.stringify(appState.currentPlan));
  } catch (error) {
    console.error("Gagal menyimpan data ke LocalStorage:", error);
  }
}

// ===================================================================
// DATE & GREETING
// ===================================================================
function setupDateDisplay() {
  const dateElem = document.getElementById("currentDateText");
  const greetingElem = document.getElementById("greetingText");

  const now = new Date();
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const formattedDate = now.toLocaleDateString("id-ID", options);

  if (dateElem) dateElem.textContent = formattedDate;

  // Dynamic Greeting based on hour
  const hour = now.getHours();
  let timeGreeting = "Pagi";
  if (hour >= 11 && hour < 15) timeGreeting = "Siang";
  else if (hour >= 15 && hour < 18) timeGreeting = "Sore";
  else if (hour >= 18 || hour < 4) timeGreeting = "Malam";

  if (greetingElem) {
    greetingElem.textContent = `Selamat ${timeGreeting}! Hari ini mau menyelesaikan apa? 👋`;
  }
}

// ===================================================================
// NAVIGATION & TABS (DESKTOP & MOBILE BOTTOM NAV)
// ===================================================================
function setupNavigation() {
  const allNavItems = document.querySelectorAll(".nav-item, .mobile-nav-item");

  allNavItems.forEach(item => {
    item.addEventListener("click", () => {
      const tabKey = item.getAttribute("data-tab");
      if (tabKey) switchTab(tabKey);
    });
  });

  // Action buttons that switch tabs
  document.getElementById("btnHeroPlanner")?.addEventListener("click", () => switchTab("planner"));
  document.getElementById("btnQuickAsk")?.addEventListener("click", () => switchTab("ask"));
  document.getElementById("btnViewFullSchedule")?.addEventListener("click", () => switchTab("schedule"));
  document.getElementById("btnQuickPlanNow")?.addEventListener("click", () => switchTab("planner"));
  document.getElementById("btnNewPlanFromSchedule")?.addEventListener("click", () => switchTab("planner"));
}

function switchTab(tabKey) {
  const desktopNavItems = document.querySelectorAll(".nav-item");
  const mobileNavItems = document.querySelectorAll(".mobile-nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  desktopNavItems.forEach(nav => {
    if (nav.getAttribute("data-tab") === tabKey) nav.classList.add("active");
    else nav.classList.remove("active");
  });

  mobileNavItems.forEach(nav => {
    if (nav.getAttribute("data-tab") === tabKey) nav.classList.add("active");
    else nav.classList.remove("active");
  });

  tabContents.forEach(content => {
    if (content.id === `tab-${tabKey}`) content.classList.add("active");
    else content.classList.remove("active");
  });

  const titles = {
    dashboard: { title: "Dashboard", subtitle: "Selamat datang kembali! Mari optimalkan harimu bersama AI." },
    planner: { title: "AI Planner Studio", subtitle: "Analisis situasi cerdas & pembuatan timeline realistis." },
    schedule: { title: "Today's Plan", subtitle: "Jadwal interaktif harian dengan fitur AI Adaptive Replanning." },
    tasks: { title: "Daftar Tugas", subtitle: "Kelola seluruh tugas harian, estimasi durasi, dan deadline." },
    ask: { title: "Ask NEXA", subtitle: "Pusat konsultasi adaptif dan penyesuaian jadwal harian." }
  };

  if (titles[tabKey]) {
    if (pageTitle) pageTitle.textContent = titles[tabKey].title;
    if (pageSubtitle) pageSubtitle.textContent = titles[tabKey].subtitle;
  }

  // Scroll to top of page on mobile
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Refresh renders when entering tab
  if (tabKey === "dashboard") renderDashboard();
  if (tabKey === "schedule") renderSchedule();
  if (tabKey === "tasks") renderTasks();
}

// ===================================================================
// DASHBOARD RENDERING
// ===================================================================
function renderDashboard() {
  const statTotal = document.getElementById("statTotalTasks");
  const statPending = document.getElementById("statTasksPending");
  const statHigh = document.getElementById("statHighPriority");
  const statProgressPct = document.getElementById("statProgressPct");
  const statProgressFraction = document.getElementById("statProgressFraction");
  const progressBar = document.getElementById("dashboardProgressBar");
  const statAvailableTime = document.getElementById("statAvailableTime");
  const badgeActiveTasks = document.getElementById("activeTasksBadge");

  // Calculations
  const totalTasks = appState.tasks.length;
  const pendingTasks = appState.tasks.filter(t => !t.completed).length;
  const highPriorityTasks = appState.tasks.filter(t => t.priority === "HIGH" && !t.completed).length;

  if (statTotal) statTotal.textContent = totalTasks;
  if (statPending) statPending.textContent = `${pendingTasks} belum selesai`;
  if (statHigh) statHigh.textContent = highPriorityTasks;
  if (badgeActiveTasks) badgeActiveTasks.textContent = pendingTasks;

  // Plan stats
  if (appState.currentPlan && appState.currentPlan.schedule) {
    const sch = appState.currentPlan.schedule;
    const completedSch = sch.filter(s => s.completed).length;
    const totalSch = sch.length;
    const pct = totalSch > 0 ? Math.round((completedSch / totalSch) * 100) : 0;

    if (statProgressPct) statProgressPct.textContent = `${pct}%`;
    if (statProgressFraction) statProgressFraction.textContent = `${completedSch}/${totalSch} Selesai`;
    if (progressBar) progressBar.style.width = `${pct}%`;

    const totalMinutes = sch.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    if (statAvailableTime) statAvailableTime.textContent = formatDuration(totalMinutes);
  }

  renderNextUpWidget();
  renderDashboardTimelinePreview();
  renderDashboardAiReasoning();
}

function renderNextUpWidget() {
  const container = document.getElementById("nextUpContainer");
  if (!container) return;

  if (!appState.currentPlan || !appState.currentPlan.schedule || appState.currentPlan.schedule.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <i class="fa-regular fa-calendar-plus"></i>
        <p>Belum ada rencana jadwal aktif untuk hari ini.</p>
        <button class="btn btn-sm btn-primary" onclick="switchTab('planner')">Buat Jadwal dengan AI</button>
      </div>
    `;
    return;
  }

  const nextItem = appState.currentPlan.schedule.find(s => !s.completed);

  if (!nextItem) {
    container.innerHTML = `
      <div class="next-up-task-box" style="border-color: var(--emerald);">
        <div class="next-up-time text-emerald">
          <i class="fa-solid fa-circle-check"></i> Semua Kegiatan Telah Selesai!
        </div>
        <div class="next-up-title">Kerja Luar Biasa! 🎉</div>
        <p class="next-up-tips">Kamu telah menyelesaikan seluruh target jadwal hari ini. Waktunya istirahat atau bersantai.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="next-up-task-box">
      <div class="next-up-time">
        <i class="fa-solid fa-clock"></i> ${nextItem.start} - ${nextItem.end} (${nextItem.duration} menit)
      </div>
      <div class="next-up-title">${nextItem.title}</div>
      <div class="next-up-tips">
        <strong>💡 Tips NEXA:</strong> ${nextItem.tips || "Fokus pada aktivitas ini secara mendalam tanpa distraksi."}
      </div>
      <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
        <button class="btn btn-sm btn-success" onclick="toggleScheduleItem('${nextItem.id}')">
          <i class="fa-solid fa-check"></i> Tandai Selesai
        </button>
      </div>
    </div>
  `;
}

function renderDashboardTimelinePreview() {
  const previewContainer = document.getElementById("dashboardTimelinePreview");
  if (!previewContainer) return;

  if (!appState.currentPlan || !appState.currentPlan.schedule || appState.currentPlan.schedule.length === 0) {
    previewContainer.innerHTML = `
      <div class="empty-state-small">
        <p>Jadwal timeline belum dibuat.</p>
      </div>
    `;
    return;
  }

  previewContainer.innerHTML = appState.currentPlan.schedule.map(item => `
    <div class="timeline-preview-item ${item.completed ? 'completed' : ''}">
      <div class="tp-time">${item.start} - ${item.end}</div>
      <div class="tp-info">
        <div class="tp-title">${item.title}</div>
      </div>
      <span class="tp-tag">${item.duration}m</span>
      <button class="btn-complete-task" onclick="toggleScheduleItem('${item.id}')" title="${item.completed ? 'Batal Selesai' : 'Selesai'}">
        <i class="fa-solid ${item.completed ? 'fa-check' : 'fa-circle'}"></i>
      </button>
    </div>
  `).join("");
}

function renderDashboardAiReasoning() {
  const reasonElem = document.getElementById("aiReasoningDashboard");
  if (!reasonElem) return;

  if (appState.currentPlan && appState.currentPlan.reasoning) {
    reasonElem.innerHTML = `
      <div style="background: rgba(6, 182, 212, 0.08); border-left: 3px solid var(--accent-cyan); padding: 12px; border-radius: var(--radius-sm);">
        <p style="font-size: 0.88rem; color: #e2e8f0; line-height: 1.5;">${appState.currentPlan.reasoning}</p>
        <div style="margin-top: 8px; font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700;">
          <i class="fa-solid fa-shield-check"></i> Dianalisis berdasarkan urgensi deadline & kapasitas waktu
        </div>
      </div>
    `;
  }
}

// ===================================================================
// TASK MANAGEMENT (CRUD & FILTERS)
// ===================================================================
function setupTaskCRUD() {
  const form = document.getElementById("taskForm");
  const searchInput = document.getElementById("taskSearchInput");
  const filterButtons = document.querySelectorAll(".filter-btn");

  // Open modal buttons
  document.getElementById("btnAddTaskModal")?.addEventListener("click", () => openTaskModal());
  document.getElementById("btnHeroAddTask")?.addEventListener("click", () => openTaskModal());
  document.getElementById("btnAddTaskFromManager")?.addEventListener("click", () => openTaskModal());
  document.getElementById("mobileBtnAddTask")?.addEventListener("click", () => openTaskModal());

  // Form Submit
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      saveTaskFromModal();
    });
  }

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      appState.searchQuery = e.target.value.toLowerCase().trim();
      renderTasks();
    });
  }

  // Priority / Status Filter tabs
  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      appState.currentFilter = btn.getAttribute("data-filter");
      renderTasks();
    });
  });
}

function openTaskModal(task = null) {
  const modal = document.getElementById("taskModal");
  const modalTitle = document.getElementById("taskModalTitle");
  const idInput = document.getElementById("taskIdInput");
  const titleInput = document.getElementById("taskTitleInput");
  const descInput = document.getElementById("taskDescInput");
  const deadlineInput = document.getElementById("taskDeadlineInput");
  const durationInput = document.getElementById("taskDurationInput");
  const prioritySelect = document.getElementById("taskPrioritySelect");
  const categorySelect = document.getElementById("taskCategorySelect");
  const notesInput = document.getElementById("taskNotesInput");

  if (!modal) return;

  if (task) {
    modalTitle.textContent = "Edit Tugas";
    idInput.value = task.id;
    titleInput.value = task.title;
    descInput.value = task.description || "";
    deadlineInput.value = task.deadline || getRelativeDate(1);
    durationInput.value = task.duration || 60;
    prioritySelect.value = task.priority || "MEDIUM";
    categorySelect.value = task.category || "STUDY";
    notesInput.value = task.notes || "";
    appState.editingTaskId = task.id;
  } else {
    modalTitle.textContent = "Tambah Tugas Baru";
    idInput.value = "";
    titleInput.value = "";
    descInput.value = "";
    deadlineInput.value = getRelativeDate(1);
    durationInput.value = 60;
    prioritySelect.value = "MEDIUM";
    categorySelect.value = "STUDY";
    notesInput.value = "";
    appState.editingTaskId = null;
  }

  modal.classList.add("active");
}

function closeTaskModal() {
  const modal = document.getElementById("taskModal");
  if (modal) modal.classList.remove("active");
}

function saveTaskFromModal() {
  const idInput = document.getElementById("taskIdInput").value;
  const title = document.getElementById("taskTitleInput").value.trim();
  const description = document.getElementById("taskDescInput").value.trim();
  const deadline = document.getElementById("taskDeadlineInput").value;
  const duration = parseInt(document.getElementById("taskDurationInput").value, 10) || 60;
  const priority = document.getElementById("taskPrioritySelect").value;
  const category = document.getElementById("taskCategorySelect").value;
  const notes = document.getElementById("taskNotesInput").value.trim();

  if (!title) {
    showToast("Nama tugas tidak boleh kosong", "warning");
    return;
  }

  if (idInput) {
    const taskIndex = appState.tasks.findIndex(t => t.id === idInput);
    if (taskIndex !== -1) {
      appState.tasks[taskIndex] = {
        ...appState.tasks[taskIndex],
        title,
        description,
        deadline,
        duration,
        priority,
        category,
        notes
      };
      showToast("Tugas berhasil diperbarui! ✨", "success");
    }
  } else {
    const newTask = {
      id: "task-" + Date.now(),
      title,
      description,
      deadline,
      duration,
      priority,
      category,
      notes,
      completed: false,
      createdAt: new Date().toISOString()
    };
    appState.tasks.unshift(newTask);
    showToast("Tugas baru berhasil ditambahkan! 🎯", "success");
  }

  saveData();
  renderTasks();
  renderDashboard();
  closeTaskModal();
}

function deleteTask(taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (!task) return;

  appState.tasks = appState.tasks.filter(t => t.id !== taskId);
  saveData();
  renderTasks();
  renderDashboard();
  showToast(`Tugas "${task.title}" telah dihapus`, "info");
}

function toggleTaskComplete(taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  saveData();
  renderTasks();
  renderDashboard();

  if (task.completed) {
    showToast(`Kerja bagus! "${task.title}" selesai ✅`, "success");
    checkAllTasksCompleted();
  }
}

function renderTasks() {
  const grid = document.getElementById("tasksGrid");
  const countAll = document.getElementById("countFilterAll");
  const countPending = document.getElementById("countFilterPending");

  if (!grid) return;

  const allCount = appState.tasks.length;
  const pendingCount = appState.tasks.filter(t => !t.completed).length;
  if (countAll) countAll.textContent = allCount;
  if (countPending) countPending.textContent = pendingCount;

  let filtered = [...appState.tasks];

  if (appState.currentFilter === "pending") {
    filtered = filtered.filter(t => !t.completed);
  } else if (appState.currentFilter === "high") {
    filtered = filtered.filter(t => t.priority === "HIGH");
  } else if (appState.currentFilter === "medium") {
    filtered = filtered.filter(t => t.priority === "MEDIUM");
  } else if (appState.currentFilter === "low") {
    filtered = filtered.filter(t => t.priority === "LOW");
  }

  if (appState.searchQuery) {
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(appState.searchQuery) ||
      (t.description && t.description.toLowerCase().includes(appState.searchQuery)) ||
      (t.notes && t.notes.toLowerCase().includes(appState.searchQuery))
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
        <i class="fa-solid fa-clipboard-list" style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 12px;"></i>
        <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Tidak ada tugas ditemukan</h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 16px;">Tambahkan tugas baru untuk mulai mengorganisasi harimu bersama NEXA.</p>
        <button class="btn btn-primary btn-sm" onclick="openTaskModal()">+ Tambah Tugas Baru</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(task => {
    const priorityClass = `priority-${task.priority.toLowerCase()}`;
    const priorityLabel = task.priority === "HIGH" ? "Tinggi" : task.priority === "MEDIUM" ? "Sedang" : "Rendah";

    return `
      <div class="task-card ${priorityClass} ${task.completed ? 'completed' : ''}">
        <div>
          <div class="task-card-header">
            <div>
              <span class="badge ${task.priority === 'HIGH' ? 'badge-priority' : task.priority === 'MEDIUM' ? 'badge-pulse' : 'badge-cyan'}" style="margin-bottom: 8px;">
                ${priorityLabel}
              </span>
              <h4 class="task-card-title">${escapeHtml(task.title)}</h4>
            </div>
            <button class="btn-complete-task" onclick="toggleTaskComplete('${task.id}')" title="${task.completed ? 'Batal Selesai' : 'Tandai Selesai'}">
              <i class="fa-solid ${task.completed ? 'fa-check' : 'fa-circle'}"></i>
            </button>
          </div>
          ${task.description ? `<p class="task-card-desc">${escapeHtml(task.description)}</p>` : ''}
        </div>

        <div>
          <div class="task-meta-grid">
            <div class="task-meta-item">
              <i class="fa-regular fa-calendar text-cyan"></i>
              <span>Deadline: ${task.deadline}</span>
            </div>
            <div class="task-meta-item">
              <i class="fa-regular fa-clock text-indigo"></i>
              <span>${task.duration} Menit</span>
            </div>
          </div>

          ${task.notes ? `
            <div style="margin-top: 10px; font-size: 0.78rem; color: var(--text-secondary); background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: var(--radius-sm);">
              <i class="fa-solid fa-note-sticky text-warning"></i> ${escapeHtml(task.notes)}
            </div>
          ` : ''}

          <div class="task-card-footer">
            <span style="font-size: 0.72rem; color: var(--text-muted);">${task.category || 'Tugas'}</span>
            <div class="task-card-actions">
              <button class="btn-icon-action" onclick="editTaskFromGrid('${task.id}')" title="Edit Tugas">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-icon-action delete" onclick="deleteTask('${task.id}')" title="Hapus Tugas">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

window.editTaskFromGrid = function (taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (task) openTaskModal(task);
};

// ===================================================================
// AI PLANNER & SITUATION ANALYSIS
// ===================================================================
function setupPlannerEvents() {
  const btnAnalyze = document.getElementById("btnAnalyzePlan");
  const btnClear = document.getElementById("btnClearSituation");
  const situationInput = document.getElementById("situationInput");
  const scenarioChips = document.querySelectorAll(".chip-btn");
  const btnApplyPlan = document.getElementById("btnApplyGeneratedPlan");
  const btnReanalyze = document.getElementById("btnReanalyzePlan");

  const scenarios = {
    exam: "Besok aku ada ujian matematika. Aku belum belajar sama sekali. Pulang sekolah jam 4 sore dan jam 7 malam ada acara keluarga. Tolong buatkan jadwal fokus yang realistis.",
    urgent1hr: "Aku baru saja tiba di rumah dan ternyata malam ini aku cuma punya waktu luang 1 jam sebelum harus istirahat tidur. Tolong atur prioritas tugas terpentingku.",
    tired: "Aku merasa sangat lelah dan mengantuk sepulang sekolah hari ini, tapi besok ada PR Fisika dan tugas Bahasa Indonesia. Tolong buatkan rencana low-energy mode dengan break lebih banyak.",
    project: "Minggu ini ada deadline proyek website dan tugas kelompok. Aku punya waktu sekitar 3 jam sore ini untuk cicil tugas terpenting."
  };

  scenarioChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const type = chip.getAttribute("data-scenario");
      if (scenarios[type]) {
        situationInput.value = scenarios[type];
        showToast("Skenario dimuat! Klik 'Analisis & Buat Rencana'", "info");
      }
    });
  });

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      situationInput.value = "";
      document.getElementById("plannerInitialState").style.display = "block";
      document.getElementById("aiLoadingBox").style.display = "none";
      document.getElementById("aiResultCard").style.display = "none";
    });
  }

  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", () => {
      const text = situationInput.value.trim();
      if (!text) {
        showToast("Tambahkan beberapa informasi tentang tugas atau kegiatanmu agar NEXA dapat membantu.", "warning");
        return;
      }
      executeAiPlanGeneration(text);
    });
  }

  if (btnApplyPlan) {
    btnApplyPlan.addEventListener("click", () => {
      if (appState.tempGeneratedPlan) {
        appState.currentPlan = JSON.parse(JSON.stringify(appState.tempGeneratedPlan));
        saveData();
        renderDashboard();
        renderSchedule();
        renderProgress();
        showToast("Rencana berhasil diterapkan ke Jadwal Hari Ini! ✨", "success");
        switchTab("schedule");
        triggerConfetti();
      }
    });
  }

  if (btnReanalyze) {
    btnReanalyze.addEventListener("click", () => {
      const text = situationInput.value.trim();
      executeAiPlanGeneration(text);
    });
  }
}

async function executeAiPlanGeneration(situationText) {
  const initialState = document.getElementById("plannerInitialState");
  const loadingBox = document.getElementById("aiLoadingBox");
  const resultCard = document.getElementById("aiResultCard");
  const loadingText = document.getElementById("loadingStepText");

  initialState.style.display = "none";
  resultCard.style.display = "none";
  loadingBox.style.display = "block";

  const steps = [
    "NEXA is analyzing your situation & constraints...",
    "Menghitung beban waktu & estimasi energi...",
    "Menentukan prioritas urutan kegiatan...",
    "Menyusun visual timeline realistis..."
  ];

  let stepIdx = 0;
  const stepInterval = setInterval(() => {
    stepIdx = (stepIdx + 1) % steps.length;
    if (loadingText) loadingText.textContent = steps[stepIdx];
  }, 600);

  const startTime = document.getElementById("plannerStartTime")?.value || "16:00";
  const energyLevel = document.getElementById("energyLevelSelect")?.value || "NORMAL";
  const includeSavedTasks = document.getElementById("checkIncludeSavedTasks")?.checked ?? true;

  try {
    let resultPlan;
    const canUseLiveApi = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== "MASUKKAN_API_KEY_KAMU_DI_SINI" && GEMINI_API_KEY.trim() !== "");

    if (canUseLiveApi) {
      resultPlan = await callGeminiAPI(situationText, {
        startTime,
        energyLevel,
        savedTasks: includeSavedTasks ? appState.tasks : []
      });
    } else {
      // Autonomous Smart Offline Engine Fallback
      await new Promise(r => setTimeout(r, 1000));
      resultPlan = smartOfflineIntelligenceEngine(situationText, {
        startTime,
        energyLevel,
        savedTasks: includeSavedTasks ? appState.tasks : []
      });
    }

    clearInterval(stepInterval);
    loadingBox.style.display = "none";

    if (resultPlan && resultPlan.schedule) {
      appState.tempGeneratedPlan = resultPlan;
      renderAiPlanResult(resultPlan);
      resultCard.style.display = "block";
      showToast("Rencana kegiatan berhasil dianalisis oleh NEXA! 🎯", "success");
    } else {
      throw new Error("Format respons AI tidak valid.");
    }
  } catch (error) {
    clearInterval(stepInterval);
    loadingBox.style.display = "none";
    console.error("Error generating AI plan:", error);

    const fallbackPlan = smartOfflineIntelligenceEngine(situationText, {
      startTime,
      energyLevel,
      savedTasks: includeSavedTasks ? appState.tasks : []
    });
    appState.tempGeneratedPlan = fallbackPlan;
    renderAiPlanResult(fallbackPlan);
    resultCard.style.display = "block";
    showToast("Rencana berhasil disusun oleh NEXA Engine.", "info");
  }
}

function renderAiPlanResult(plan) {
  const summaryTitle = document.getElementById("resultSummaryTitle");
  const priorityBadge = document.getElementById("resultPriorityBadge");
  const totalTime = document.getElementById("resultTotalTime");
  const totalSessions = document.getElementById("resultTotalSessions");
  const breakTime = document.getElementById("resultBreakTime");
  const recText = document.getElementById("resultRecommendationText");
  const reasoningText = document.getElementById("resultReasoningText");
  const scheduleList = document.getElementById("resultScheduleList");

  if (summaryTitle) summaryTitle.textContent = plan.summary || "Rencana Kegiatan Harian";
  if (priorityBadge) priorityBadge.textContent = `${plan.priority || 'HIGH'} PRIORITY`;
  if (totalTime) totalTime.textContent = formatDuration(plan.totalTime || 120);

  const breaks = plan.schedule.filter(s => s.type === "BREAK");
  const breakMinutes = breaks.reduce((acc, b) => acc + (b.duration || 0), 0);

  if (totalSessions) totalSessions.textContent = `${plan.schedule.length} Aktivitas`;
  if (breakTime) breakTime.textContent = `${breakMinutes} Menit`;
  if (recText) recText.textContent = plan.recommendation || "Laksanakan rencana secara teratur.";
  if (reasoningText) reasoningText.textContent = plan.reasoning || "Prioritas diurutkan berdasarkan urgensi waktu dan deadline.";

  if (scheduleList) {
    scheduleList.innerHTML = plan.schedule.map(item => `
      <div class="timeline-preview-item">
        <div class="tp-time">${item.start} - ${item.end}</div>
        <div class="tp-info">
          <div class="tp-title">${item.title}</div>
        </div>
        <span class="tp-tag">${item.duration}m</span>
      </div>
    `).join("");
  }
}

// ===================================================================
// GEMINI API INTEGRATION & SMART OFFLINE ENGINE
// ===================================================================
async function callGeminiAPI(userInput, context) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const promptContent = `
SITUASI PENGGUNA:
"${userInput}"

KONTEKS TAMBAHAN:
- Waktu Mulai: ${context.startTime}
- Tingkat Energi: ${context.energyLevel}
- Daftar Tugas Tersimpan: ${JSON.stringify(context.savedTasks || [])}

Tolong lakukan analisis situasi mendalam dan buatkan struktur JSON rencana kegiatan sesuai aturan system prompt.
Kembalikan HANYA JSON.
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: NEXA_SYSTEM_PROMPT },
          { text: promptContent }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error("Respons kosong dari Gemini API");
  }

  let cleaned = textResponse.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);

  if (parsed.schedule && Array.isArray(parsed.schedule)) {
    parsed.schedule = parsed.schedule.map((item, idx) => ({
      id: `sch-${Date.now()}-${idx}`,
      ...item,
      completed: false
    }));
  }

  return parsed;
}

/**
 * Smart Offline Intelligence Engine (Autonomous Simulator)
 */
function smartOfflineIntelligenceEngine(userInput, context) {
  const inputLower = userInput.toLowerCase();
  const startTime = context.startTime || "16:00";
  const [startHour, startMin] = startTime.split(":").map(Number);

  // Scenario 1: Hanya punya 1 jam / Waktu sedikit
  if (inputLower.includes("1 jam") || inputLower.includes("60 menit") || inputLower.includes("waktu sedikit") || inputLower.includes("cuma punya")) {
    const t0 = formatClockTime(startHour, startMin);
    const t1 = formatClockTime(startHour, startMin + 30);
    const t2 = formatClockTime(startHour, startMin + 50);
    const t3 = formatClockTime(startHour, startMin + 60);

    return {
      summary: "Rencana Kilat 1 Jam (Urgensi Tinggi)",
      priority: "HIGH",
      totalTime: 60,
      recommendation: "Fokus 100% pada latihan soal dan rumus inti. Pangkas istirahat panjang dan tunda tugas-tugas opsional.",
      reasoning: "Karena keterbatasan waktu 60 menit, NEXA memangkas review santai dan langsung mengalokasikan 80% waktu untuk materi ujian terpenting.",
      schedule: [
        {
          id: `sch-${Date.now()}-1`,
          start: t0,
          end: t1,
          title: "🎯 Latihan Soal Inti Ujian Matematika",
          type: "PRACTICE",
          duration: 30,
          priority: "HIGH",
          tips: "Kerjakan tipe soal yang paling sering keluar dalam ujian.",
          completed: false
        },
        {
          id: `sch-${Date.now()}-2`,
          start: t1,
          end: t2,
          title: "🧠 Bedah Materi yang Belum Dikuasai",
          type: "STUDY",
          duration: 20,
          priority: "HIGH",
          tips: "Perbaiki kesalahan pengerjaan dan catat rumus penting.",
          completed: false
        },
        {
          id: `sch-${Date.now()}-3`,
          start: t2,
          end: t3,
          title: "📝 Quick Recall & Persiapan Alat Ujian",
          type: "REVIEW",
          duration: 10,
          priority: "HIGH",
          tips: "Uji ingatan tanpa melihat rumus dan rapikan tas belajar.",
          completed: false
        }
      ]
    };
  }

  // Scenario 2: Sedang Lelah / Low Energy Mode
  if (inputLower.includes("lelah") || inputLower.includes("capek") || inputLower.includes("ngantuk") || context.energyLevel === "TIRED") {
    const t0 = formatClockTime(startHour, startMin);
    const t1 = formatClockTime(startHour, startMin + 20);
    const t2 = formatClockTime(startHour, startMin + 35);
    const t3 = formatClockTime(startHour, startMin + 55);
    const t4 = formatClockTime(startHour, startMin + 70);

    return {
      summary: "Low Energy Recovery & Smart Study Plan",
      priority: "MEDIUM",
      totalTime: 70,
      recommendation: "Gunakan metode Pomodoro ringan (20m belajar : 15m istirahat). Jangan memaksakan maraton agar retensi tetap optimal.",
      reasoning: "Saat energi rendah, daya konsentrasi menurun drastis setelah 25 menit. Menambahkan jeda aktif mencegah burnout dan menjaga kualitas pemahaman.",
      schedule: [
        {
          id: `sch-${Date.now()}-1`,
          start: t0,
          end: t1,
          title: "📚 Review Santai Catatan Rumus",
          type: "STUDY",
          duration: 20,
          priority: "HIGH",
          tips: "Baca poin-poin penting sambil duduk tegak.",
          completed: false
        },
        {
          id: `sch-${Date.now()}-2`,
          start: t1,
          end: t2,
          title: "☕ Power Break & Minum Air",
          type: "BREAK",
          duration: 15,
          priority: "LOW",
          tips: "Cuci muka, minum air dingin, hindari scrolling sosmed.",
          completed: false
        },
        {
          id: `sch-${Date.now()}-3`,
          start: t2,
          end: t3,
          title: "🧠 Kerjakan 3 Soal Kunci",
          type: "PRACTICE",
          duration: 20,
          priority: "HIGH",
          tips: "Fokus menyelesaikan sedikit soal namun paham secara mendalam.",
          completed: false
        },
        {
          id: `sch-${Date.now()}-4`,
          start: t3,
          end: t4,
          title: "🧘 Relaksasi Akhir & Istirahat Malam",
          type: "BREAK",
          duration: 15,
          priority: "LOW",
          tips: "Tidur lebih awal untuk memulihkan energi menghadapi ujian besok.",
          completed: false
        }
      ]
    };
  }

  // Scenario 3: Ujian Matematika (Default Standar 2.5 Jam)
  const t0 = formatClockTime(startHour, startMin + 30);
  const t1 = formatClockTime(startHour + 1, startMin);
  const t2 = formatClockTime(startHour + 1, startMin + 40);
  const t3 = formatClockTime(startHour + 1, startMin + 55);
  const t4 = formatClockTime(startHour + 2, startMin + 40);
  const t5 = formatClockTime(startHour + 3, startMin);

  return {
    summary: "Persiapan Komprehensif Ujian Matematika",
    priority: "HIGH",
    totalTime: 150,
    recommendation: "Kombinasikan review konsep persamaan kuadrat dengan latihan intensif serta jeda istirahat 15 menit.",
    reasoning: "Ujian memiliki deadline besok pagi dengan bobot nilai tinggi. Urutan disusun dari pemahaman konsep -> latihan soal -> penanganan materi sulit -> review akhir.",
    schedule: [
      {
        id: `sch-${Date.now()}-1`,
        start: t0,
        end: t1,
        title: "📚 Review Materi & Rumus Persamaan Kuadrat",
        type: "STUDY",
        duration: 30,
        priority: "HIGH",
        tips: "Pahami rumus abc, pemfaktoran, dan bentuk kuadrat sempurna.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-2`,
        start: t1,
        end: t2,
        title: "🧠 Latihan Soal Ujian Matematika",
        type: "PRACTICE",
        duration: 40,
        priority: "HIGH",
        tips: "Kerjakan variasi soal tipe diskriminan dan akar persamaan.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-3`,
        start: t2,
        end: t3,
        title: "☕ Break & Stretching",
        type: "BREAK",
        duration: 15,
        priority: "LOW",
        tips: "Istirahatkan mata sejenak agar otak segar kembali.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-4`,
        start: t3,
        end: t4,
        title: "🎯 Pendalaman Materi yang Masih Bingung",
        type: "STUDY",
        duration: 45,
        priority: "HIGH",
        tips: "Kaji ulang materi yang salah saat latihan.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-5`,
        start: t4,
        end: t5,
        title: "📝 Quick Review Akhir Sebelum Jam 19:00",
        type: "REVIEW",
        duration: 20,
        priority: "HIGH",
        tips: "Pastikan seluruh persiapan telah rampung sebelum acara keluarga.",
        completed: false
      }
    ]
  };
}

function formatClockTime(h, m) {
  let hour = h + Math.floor(m / 60);
  let min = m % 60;
  hour = hour % 24;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ===================================================================
// TODAY'S PLAN & TIMELINE EXECUTION
// ===================================================================
function renderSchedule() {
  const timeline = document.getElementById("verticalTimeline");
  const title = document.getElementById("timelineTitle");

  if (!timeline) return;

  if (!appState.currentPlan || !appState.currentPlan.schedule || appState.currentPlan.schedule.length === 0) {
    timeline.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <i class="fa-regular fa-calendar-xmark" style="font-size: 2.2rem; margin-bottom: 12px; color: var(--text-muted);"></i>
        <h4 style="color: #ffffff; margin-bottom: 6px;">Belum Ada Jadwal Aktif</h4>
        <p style="font-size: 0.85rem; margin-bottom: 16px;">Gunakan menu AI Planner untuk menganalisis dan membuat timeline kegiatan harianmu.</p>
        <button class="btn btn-primary btn-sm" onclick="switchTab('planner')">✨ Buka AI Planner</button>
      </div>
    `;
    return;
  }

  if (title) title.textContent = appState.currentPlan.summary || "Jadwal Rencana Hari Ini";

  timeline.innerHTML = appState.currentPlan.schedule.map(item => {
    const typeClass = `type-${(item.type || 'study').toLowerCase()}`;
    const isCompleted = Boolean(item.completed);

    return `
      <div class="timeline-node ${isCompleted ? 'completed' : ''}" id="node-${item.id}">
        <div class="timeline-marker">
          <i class="fa-solid ${isCompleted ? 'fa-check' : 'fa-clock'}"></i>
        </div>
        <div class="timeline-card">
          <div class="tl-time-block">
            <div class="tl-start-end">${item.start} - ${item.end}</div>
            <span class="tl-duration-badge">${item.duration} Menit</span>
          </div>

          <div class="tl-main-info">
            <div class="tl-meta-row">
              <span class="tl-type-tag ${typeClass}">${item.type || 'TASK'}</span>
              <span class="badge ${item.priority === 'HIGH' ? 'badge-priority' : 'badge-cyan'}">${item.priority || 'NORMAL'}</span>
            </div>
            <h4 class="tl-title">${item.title}</h4>
            ${item.tips ? `<p class="tl-tips-text"><i class="fa-solid fa-lightbulb text-warning"></i> ${escapeHtml(item.tips)}</p>` : ''}
          </div>

          <button class="btn-complete-task" onclick="toggleScheduleItem('${item.id}')" title="${isCompleted ? 'Batal Selesai' : 'Tandai Selesai'}">
            <i class="fa-solid ${isCompleted ? 'fa-check' : 'fa-circle'}"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");

  renderPlanUpdatedBanner();
}

window.toggleScheduleItem = function (itemId) {
  if (!appState.currentPlan || !appState.currentPlan.schedule) return;

  const item = appState.currentPlan.schedule.find(s => s.id === itemId);
  if (!item) return;

  item.completed = !item.completed;
  saveData();
  renderSchedule();
  renderDashboard();
  renderProgress();

  if (item.completed) {
    showToast(`Hebat! "${item.title}" selesai ✅`, "success");
    checkAllScheduleCompleted();
  }
};

function resetCompletedSchedule() {
  if (!appState.currentPlan || !appState.currentPlan.schedule) return;
  appState.currentPlan.schedule.forEach(s => s.completed = false);
  saveData();
  renderSchedule();
  renderDashboard();
  renderProgress();
  showToast("Status seluruh jadwal telah direset ke awal", "info");
}

function checkAllScheduleCompleted() {
  if (!appState.currentPlan || !appState.currentPlan.schedule) return;
  const allDone = appState.currentPlan.schedule.every(s => s.completed);
  if (allDone && appState.currentPlan.schedule.length > 0) {
    triggerConfetti();
    showToast("🎉 LUAR BIASA! Seluruh rencana kegiatan hari ini berhasil diselesaikan!", "success");
  }
}

function checkAllTasksCompleted() {
  const allDone = appState.tasks.length > 0 && appState.tasks.every(t => t.completed);
  if (allDone) {
    triggerConfetti();
    showToast("🌟 SEMUA TUGAS SELESAI! Kamu sangat produktif hari ini!", "success");
  }
}

// ===================================================================
// AI ADAPTIVE REPLANNING
// ===================================================================
function setupAdaptiveControls() {
  const adaptButtons = document.querySelectorAll(".btn-adapt");
  const btnCustomAdaptModal = document.getElementById("btnCustomAdaptModal");
  const btnSubmitCustomAdapt = document.getElementById("btnSubmitCustomAdapt");
  const customConditionInput = document.getElementById("customConditionInput");
  const btnCloseBanner = document.getElementById("btnCloseUpdatedBanner");
  const btnResetSchedule = document.getElementById("btnResetCompletedSchedule");

  adaptButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const conditionType = btn.getAttribute("data-condition");
      applyAdaptiveCondition(conditionType);
    });
  });

  if (btnResetSchedule) {
    btnResetSchedule.addEventListener("click", resetCompletedSchedule);
  }

  if (btnCustomAdaptModal) {
    btnCustomAdaptModal.addEventListener("click", () => {
      document.getElementById("customAdaptModal")?.classList.add("active");
    });
  }

  document.querySelectorAll(".tag-btn").forEach(tag => {
    tag.addEventListener("click", () => {
      if (customConditionInput) {
        customConditionInput.value = tag.getAttribute("data-text");
      }
    });
  });

  if (btnSubmitCustomAdapt) {
    btnSubmitCustomAdapt.addEventListener("click", () => {
      const text = customConditionInput.value.trim();
      if (!text) {
        showToast("Masukkan kondisi perubahan rencanamu.", "warning");
        return;
      }
      document.getElementById("customAdaptModal")?.classList.remove("active");
      applyAdaptiveCondition("custom", text);
    });
  }

  if (btnCloseBanner) {
    btnCloseBanner.addEventListener("click", () => {
      const banner = document.getElementById("planUpdatedBanner");
      if (banner) banner.style.display = "none";
    });
  }
}

function applyAdaptiveCondition(conditionType, customText = "") {
  if (!appState.currentPlan || !appState.currentPlan.schedule) {
    showToast("Belum ada rencana jadwal aktif untuk disesuaikan.", "warning");
    return;
  }

  const beforePlan = JSON.parse(JSON.stringify(appState.currentPlan));
  const beforeTotalMinutes = beforePlan.schedule.reduce((acc, c) => acc + (c.duration || 0), 0);
  const beforeTimeStr = formatDuration(beforeTotalMinutes);

  let updatedSchedule = [];
  let changesInfo = {};

  if (conditionType === "less_time") {
    updatedSchedule = [
      {
        id: `sch-${Date.now()}-1`,
        start: "16:30",
        end: "17:05",
        title: "🎯 Latihan Soal Persamaan Kuadrat (Prioritas Utama)",
        type: "PRACTICE",
        duration: 35,
        priority: "HIGH",
        tips: "Kerjakan langsung soal tipe ujian terpenting.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-2`,
        start: "17:05",
        end: "17:25",
        title: "🧠 Review Materi yang Belum Dikuasai",
        type: "STUDY",
        duration: 20,
        priority: "HIGH",
        tips: "Fokus rumus kunci yang masih sering lupa.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-3`,
        start: "17:25",
        end: "17:30",
        title: "📝 Quick Formula Check",
        type: "REVIEW",
        duration: 5,
        priority: "HIGH",
        tips: "Pengecekan akhir sebelum waktu habis.",
        completed: false
      }
    ];

    changesInfo = {
      isAdapted: true,
      beforeTime: beforeTimeStr,
      nowTime: "1 Jam (60 Menit)",
      removed: [
        "Review materi pengantar santai (30 menit)",
        "Jeda istirahat panjang (15 menit)"
      ],
      prioritized: [
        "Latihan soal ujian persamaan kuadrat",
        "Pemantapan materi yang belum dikuasai"
      ],
      advice: "Karena waktu berkurang menjadi 1 jam, NEXA memangkas sesi pengantar dan fokus 100% pada latihan soal inti untuk ujian besok."
    };
  } else if (conditionType === "tired") {
    updatedSchedule = [
      {
        id: `sch-${Date.now()}-1`,
        start: "16:30",
        end: "16:55",
        title: "📚 Review Santai Ringan Rumus",
        type: "STUDY",
        duration: 25,
        priority: "HIGH",
        tips: "Baca ringkasan tanpa beban berlebih.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-2`,
        start: "16:55",
        end: "17:15",
        title: "☕ Power Break & Relaksasi Pikiran",
        type: "BREAK",
        duration: 20,
        priority: "LOW",
        tips: "Peregangan otot dan rileksasi mata.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-3`,
        start: "17:15",
        end: "17:45",
        title: "🎯 Kerjakan 4 Soal Kunci Saja",
        type: "PRACTICE",
        duration: 30,
        priority: "HIGH",
        tips: "Kualitas pemahaman lebih penting daripada kuantitas saat lelah.",
        completed: false
      }
    ];

    changesInfo = {
      isAdapted: true,
      beforeTime: beforeTimeStr,
      nowTime: "1 Jam 15 Menit",
      removed: [
        "Sesi latihan maraton intensif (45 menit)"
      ],
      prioritized: [
        "Istirahat berkualitas (20 menit)",
        "Pengerjaan 4 soal kunci berbobot tinggi"
      ],
      advice: "NEXA mengaktifkan Low Energy Mode: Durasi belajar diperpendek dan waktu jeda ditingkatkan agar otak tidak jenuh."
    };
  } else if (conditionType === "late") {
    updatedSchedule = beforePlan.schedule.map(item => {
      const [sh, sm] = item.start.split(":").map(Number);
      const [eh, em] = item.end.split(":").map(Number);
      return {
        ...item,
        start: formatClockTime(sh, sm + 30),
        end: formatClockTime(eh, em + 30),
        completed: false
      };
    });

    changesInfo = {
      isAdapted: true,
      beforeTime: beforeTimeStr,
      nowTime: `${beforeTimeStr} (Digeser +30 Menit)`,
      removed: [
        "Tidak ada aktivitas yang dipangkas"
      ],
      prioritized: [
        "Seluruh jadwal digeser secara otomatis 30 menit ke depan"
      ],
      advice: "Jadwal telah diselaraskan dengan waktu mulai terbarumu tanpa menghilangkan aktivitas penting."
    };
  } else if (conditionType === "urgent_task") {
    updatedSchedule = [
      {
        id: `sch-${Date.now()}-1`,
        start: "16:30",
        end: "17:10",
        title: "🚨 Tugas Tambahan Baru (Urgensi Tinggi)",
        type: "TASK",
        duration: 40,
        priority: "HIGH",
        tips: "Selesaikan instruksi tugas baru terlebih dahulu.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-2`,
        start: "17:10",
        end: "17:50",
        title: "🧠 Latihan Soal Ujian Matematika",
        type: "PRACTICE",
        duration: 40,
        priority: "HIGH",
        tips: "Fokus ke soal esensial.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-3`,
        start: "17:50",
        end: "18:00",
        title: "☕ Mini Break",
        type: "BREAK",
        duration: 10,
        priority: "LOW",
        tips: "Istirahat sejenak.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-4`,
        start: "18:00",
        end: "18:40",
        title: "📝 Quick Review Materi",
        type: "REVIEW",
        duration: 40,
        priority: "HIGH",
        tips: "Rangkuman materi sebelum acara.",
        completed: false
      }
    ];

    changesInfo = {
      isAdapted: true,
      beforeTime: beforeTimeStr,
      nowTime: "2 Jam 10 Menit",
      removed: [
        "Review awal digabung ke sesi penutup"
      ],
      prioritized: [
        "Tugas tambahan baru",
        "Latihan soal ujian matematika"
      ],
      advice: "NEXA menyisipkan tugas baru di slot awal untuk menghindari penumpukan deadline di malam hari."
    };
  } else {
    updatedSchedule = [
      {
        id: `sch-${Date.now()}-1`,
        start: "16:30",
        end: "17:15",
        title: `🎯 ${customText.substring(0, 35)}...`,
        type: "PRACTICE",
        duration: 45,
        priority: "HIGH",
        tips: "Disesuaikan berdasarkan kondisi spesifik pengguna.",
        completed: false
      },
      {
        id: `sch-${Date.now()}-2`,
        start: "17:15",
        end: "17:30",
        title: "📝 Evaluasi Cepat & Selesai",
        type: "REVIEW",
        duration: 15,
        priority: "HIGH",
        tips: "Penyelesaian target.",
        completed: false
      }
    ];

    changesInfo = {
      isAdapted: true,
      beforeTime: beforeTimeStr,
      nowTime: "1 Jam (Disesuaikan)",
      removed: ["Aktivitas sekunder ditunda"],
      prioritized: ["Target spesifik kondisi kustom"],
      advice: `Rencana telah diselaraskan dengan kondisimu: "${customText}"`
    };
  }

  appState.currentPlan.schedule = updatedSchedule;
  appState.currentPlan.changes = changesInfo;
  saveData();

  renderSchedule();
  renderDashboard();
  renderProgress();

  showToast("Jadwal berhasil diadaptasi oleh NEXA! ✨", "success");
}

function renderPlanUpdatedBanner() {
  const banner = document.getElementById("planUpdatedBanner");
  if (!banner) return;

  if (appState.currentPlan && appState.currentPlan.changes && appState.currentPlan.changes.isAdapted) {
    const changes = appState.currentPlan.changes;
    const beforeTimeElem = document.getElementById("compBeforeTime");
    const nowTimeElem = document.getElementById("compNowTime");
    const removedList = document.getElementById("compRemovedList");
    const prioritizedList = document.getElementById("compPrioritizedList");
    const reasonText = document.getElementById("compReasonText");

    if (beforeTimeElem) beforeTimeElem.textContent = changes.beforeTime || "2 Jam 30 Menit";
    if (nowTimeElem) nowTimeElem.textContent = changes.nowTime || "1 Jam";

    if (removedList) {
      removedList.innerHTML = (changes.removed && changes.removed.length > 0)
        ? changes.removed.map(r => `<li>${escapeHtml(r)}</li>`).join("")
        : `<li>Tidak ada yang dipangkas</li>`;
    }

    if (prioritizedList) {
      prioritizedList.innerHTML = (changes.prioritized && changes.prioritized.length > 0)
        ? changes.prioritized.map(p => `<li>${escapeHtml(p)}</li>`).join("")
        : `<li>Semua aktivitas dipertahankan</li>`;
    }

    if (reasonText) reasonText.textContent = changes.advice || "Jadwal disesuaikan dengan kondisi terbaru.";

    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }
}

// ===================================================================
// PROGRESS CALCULATION & CELEBRATION
// ===================================================================
function renderProgress() {
  if (!appState.currentPlan || !appState.currentPlan.schedule) return;

  const total = appState.currentPlan.schedule.length;
  const completed = appState.currentPlan.schedule.filter(s => s.completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const statPct = document.getElementById("statProgressPct");
  const statFraction = document.getElementById("statProgressFraction");
  const progressBar = document.getElementById("dashboardProgressBar");

  if (statPct) statPct.textContent = `${pct}%`;
  if (statFraction) statFraction.textContent = `${completed}/${total} Selesai`;
  if (progressBar) progressBar.style.width = `${pct}%`;
}

function triggerConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const count = 70;
  const colors = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      r: Math.random() * 6 + 4,
      d: Math.random() * count,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncremental: (Math.random() * 0.07) + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  let frameCount = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d);
      p.tilt = Math.sin(p.tiltAngle) * 15;

      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
      ctx.stroke();
    });

    frameCount++;
    if (frameCount < 120) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  draw();
}

// ===================================================================
// ASK NEXA (CONSULTATION HUB)
// ===================================================================
function setupChatHub() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const suggestions = document.querySelectorAll(".suggestion-pill");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      handleUserChatMessage(message);
      input.value = "";
    });
  }

  suggestions.forEach(pill => {
    pill.addEventListener("click", () => {
      const askText = pill.getAttribute("data-ask");
      if (askText) {
        handleUserChatMessage(askText);
      }
    });
  });
}

function handleUserChatMessage(text) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  appendChatBubble("user", text);

  setTimeout(() => {
    const textLower = text.toLowerCase();
    let botReply = "";
    let offerPlan = false;
    let conditionKey = "";

    if (textLower.includes("lelah") || textLower.includes("capek")) {
      botReply = "NEXA memahami energimu sedang turun. Memaksakan belajar terlalu lama saat lelah justru menurunkan daya ingat. NEXA menyarankan beralih ke **Low Energy Mode**: memperpendek sesi belajar menjadi 20 menit dan menyisipkan jeda istirahat aktif.";
      offerPlan = true;
      conditionKey = "tired";
    } else if (textLower.includes("30 menit") || textLower.includes("waktu sedikit") || textLower.includes("1 jam")) {
      botReply = "Karena waktu yang kamu miliki sangat terbatas, NEXA menyarankan memangkas materi pengantar dan langsung fokus menyelesaikan latihan soal ujian matematika yang berbobot paling besar.";
      offerPlan = true;
      conditionKey = "less_time";
    } else if (textLower.includes("tugas tambahan") || textLower.includes("guru")) {
      botReply = "Tugas tambahan mendadak sebaiknya diselesaikan di awal atau dipecah menjadi bagian kecil agar tidak menumpuk dengan persiapan ujian besok. NEXA siap menyisipkan tugas baru ke dalam jadwalmu.";
      offerPlan = true;
      conditionKey = "urgent_task";
    } else {
      botReply = `NEXA telah menganalisis pertanyaanmu: "${text}". Untuk hasil terbaik, fokuslah pada tugas dengan deadline paling dekat (Ujian Matematika) dan luangkan setidaknya 15 menit untuk mereview rumus sebelum istirahat.`;
      offerPlan = true;
      conditionKey = "custom";
    }

    appendChatBubble("bot", botReply, offerPlan, conditionKey, text);
  }, 600);
}

function appendChatBubble(sender, text, offerPlan = false, conditionKey = "", rawInput = "") {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${sender === 'user' ? 'user-message' : 'bot-message'}`;

  let planCardHtml = "";
  if (offerPlan) {
    planCardHtml = `
      <div class="chat-plan-card">
        <div class="chat-plan-title">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Rekomendasi Penyesuaian Jadwal
        </div>
        <p class="chat-plan-details">NEXA dapat langsung menerapkan perubahan strategi ini ke dalam timeline jadwal harianmu.</p>
        <button class="btn btn-sm btn-success" onclick="applyPlanFromChat('${conditionKey}', '${escapeHtml(rawInput)}')">
          <i class="fa-solid fa-calendar-check"></i> Terapkan Rencana Ini (Apply Plan)
        </button>
      </div>
    `;
  }

  bubble.innerHTML = `
    <div class="msg-avatar">
      <i class="fa-solid ${sender === 'user' ? 'fa-user' : 'fa-brain'}"></i>
    </div>
    <div class="msg-content">
      <div class="msg-author">${sender === 'user' ? 'Kamu' : 'NEXA Assistant'}</div>
      <p>${text}</p>
      ${planCardHtml}
      <span class="msg-time">${timeStr}</span>
    </div>
  `;

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.applyPlanFromChat = function (conditionKey, rawInput) {
  applyAdaptiveCondition(conditionKey, rawInput);
  switchTab("schedule");
};

// ===================================================================
// MODAL UTILITIES
// ===================================================================
function setupModals() {
  document.getElementById("btnCloseTaskModal")?.addEventListener("click", closeTaskModal);
  document.getElementById("btnCancelTaskModal")?.addEventListener("click", closeTaskModal);

  document.getElementById("btnCloseCustomAdaptModal")?.addEventListener("click", () => {
    document.getElementById("customAdaptModal")?.classList.remove("active");
  });
  document.getElementById("btnCancelCustomAdapt")?.addEventListener("click", () => {
    document.getElementById("customAdaptModal")?.classList.remove("active");
  });
}

// ===================================================================
// TOAST NOTIFICATION SYSTEM
// ===================================================================
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = {
    success: "fa-circle-check",
    warning: "fa-triangle-exclamation",
    error: "fa-circle-xmark",
    info: "fa-circle-info"
  };

  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || 'fa-bell'}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.3s ease-out";
    setTimeout(() => toast.remove(), 300);
  }, 3600);
}

// Helper: Format minutes into "X Jam Y Menit"
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} Menit`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} Jam ${mins} Menit` : `${hrs} Jam`;
}

// Helper: Escape HTML string to prevent XSS
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global Window Function Attachments for Inline HTML Handlers
window.switchTab = switchTab;
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.toggleTaskComplete = toggleTaskComplete;
window.deleteTask = deleteTask;
window.toggleScheduleItem = toggleScheduleItem;
window.editTaskFromGrid = editTaskFromGrid;
window.applyPlanFromChat = applyPlanFromChat;
window.resetCompletedSchedule = resetCompletedSchedule;

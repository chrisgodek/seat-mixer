const SUITS = [
  { key: "clubs", symbol: "♣", label: "Clubs", color: "black" },
  { key: "hearts", symbol: "♥", label: "Hearts", color: "red" },
  { key: "diamonds", symbol: "♦", label: "Diamonds", color: "red" },
  { key: "spades", symbol: "♠", label: "Spades", color: "black" }
];

const TABLE_COLORS = ["Blue", "Green", "Yellow", "Red", "Purple", "Orange", "Teal", "Silver"];

const state = {
  students: [],
  groups: [],
  preferences: {},
  savedCharts: []
};

const el = id => document.getElementById(id);

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem("seatMixerState") || "{}");
    state.preferences = saved.preferences || {};
    state.savedCharts = saved.savedCharts || [];
    if (saved.settings) {
      el("rows").value = saved.settings.rows || 3;
      el("columns").value = saved.settings.columns || 3;
      el("tableNaming").value = saved.settings.tableNaming || "numbers";
      el("theme").value = saved.settings.theme || "blue";
      el("chartTitle").value = saved.settings.chartTitle || "Seating Chart";
      el("slidesMode").checked = Boolean(saved.settings.slidesMode);
      el("roster").value = saved.settings.roster || "";
    }
  } catch (error) {
    console.warn("Could not restore saved Seat Mixer data.", error);
  }
}

function persist() {
  const settings = {
    rows: Number(el("rows").value),
    columns: Number(el("columns").value),
    tableNaming: el("tableNaming").value,
    theme: el("theme").value,
    chartTitle: el("chartTitle").value,
    slidesMode: el("slidesMode").checked,
    roster: el("roster").value
  };
  localStorage.setItem("seatMixerState", JSON.stringify({
    preferences: state.preferences,
    savedCharts: state.savedCharts,
    settings
  }));
}

function parseRoster() {
  return [...new Set(
    el("roster").value
      .split(/\n|\t/)
      .map(name => name.trim())
      .filter(Boolean)
  )];
}

function loadRoster(showMessage = true) {
  state.students = parseRoster().map(name => ({
    name,
    needsFront: Boolean(state.preferences[name])
  }));
  state.groups = [];
  renderStudentOptions();
  renderChart();
  persist();
  if (showMessage) setStatus(`${state.students.length} student(s) loaded.`);
}

function renderStudentOptions() {
  const container = el("studentOptions");
  container.innerHTML = "";

  if (!state.students.length) {
    container.innerHTML = '<p class="help">Load a roster to select students.</p>';
    return;
  }

  state.students.forEach((student, index) => {
    const label = document.createElement("label");
    label.className = "student-option";
    label.htmlFor = `front-${index}`;

    const checkbox = document.createElement("input");
    checkbox.id = `front-${index}`;
    checkbox.type = "checkbox";
    checkbox.checked = student.needsFront;
    checkbox.addEventListener("change", () => {
      student.needsFront = checkbox.checked;
      state.preferences[student.name] = checkbox.checked;
      persist();
      setStatus(`${student.name}: front-seat priority ${checkbox.checked ? "saved" : "removed"}.`);
    });

    const text = document.createElement("span");
    text.textContent = student.name;

    label.append(checkbox, text);
    container.appendChild(label);
  });
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffleSeats() {
  if (!state.students.length) loadRoster(false);
  if (!state.students.length) {
    setStatus("Paste and load at least one student first.");
    return;
  }

  const rows = clamp(Number(el("rows").value), 1, 8);
  const columns = clamp(Number(el("columns").value), 1, 8);
  const tableCount = rows * columns;
  const capacity = tableCount * 4;

  if (state.students.length > capacity) {
    setStatus(`This room holds ${capacity} students. Add more table groups.`);
    return;
  }

  const front = shuffle(state.students.filter(student => student.needsFront));
  const others = shuffle(state.students.filter(student => !student.needsFront));
  const ordered = [...front, ...others];

  state.groups = Array.from({ length: tableCount }, () => []);
  let cursor = 0;

  // Fill front tables first so priority students remain toward the whiteboard.
  ordered.forEach(student => {
    while (state.groups[cursor].length >= 4) cursor += 1;
    state.groups[cursor].push(student);
  });

  renderChart();
  persist();
  setStatus(`${state.students.length} students shuffled into ${state.groups.filter(group => group.length).length} table groups.`);
}

function getTableName(index) {
  const mode = el("tableNaming").value;
  if (mode === "letters") return `Table ${String.fromCharCode(65 + index)}`;
  if (mode === "colors") return `${TABLE_COLORS[index % TABLE_COLORS.length]} Table`;
  return `Table ${index + 1}`;
}

function renderChart() {
  const rows = clamp(Number(el("rows").value), 1, 8);
  const columns = clamp(Number(el("columns").value), 1, 8);
  const tableCount = rows * columns;
  const room = el("room");
  const chart = el("chart");

  chart.dataset.theme = el("theme").value;
  chart.classList.toggle("slides-mode", el("slidesMode").checked);
  el("displayTitle").textContent = el("chartTitle").value.trim() || "Seating Chart";
  el("displayDate").textContent = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric"
  }).format(new Date());

  room.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  room.innerHTML = "";

  for (let i = 0; i < tableCount; i++) {
    const group = state.groups[i] || [];
    const table = document.createElement("section");
    table.className = "table-group";

    const tableLabel = document.createElement("div");
    tableLabel.className = "table-label";
    tableLabel.innerHTML = `<span>${escapeHtml(getTableName(i))}</span><span>${group.length}/4</span>`;

    const suitGrid = document.createElement("div");
    suitGrid.className = "suit-grid";

    SUITS.forEach((suit, seatIndex) => {
      const student = group[seatIndex];
      const seat = document.createElement("div");
      seat.className = `seat${student?.needsFront ? " front-priority" : ""}`;

      const suitLabel = document.createElement("div");
      suitLabel.className = `suit ${suit.color}`;
      suitLabel.textContent = `${suit.symbol} ${suit.label}`;

      const studentName = document.createElement("div");
      studentName.className = `student-name${student ? "" : " empty"}`;
      studentName.textContent = student ? student.name : "Empty";

      seat.append(suitLabel, studentName);

      //if (student?.needsFront) {
        //const note = document.createElement("div");
        //note.className = "front-note";
        //note.textContent = "FRONT PRIORITY";
        //seat.appendChild(note);
      //}

      suitGrid.appendChild(seat);
    });

    table.append(tableLabel, suitGrid);
    room.appendChild(table);
  }

  updateSlidesExport();
}

function updateSlidesExport() {
  if (!state.groups.some(group => group.length)) {
    el("slidesExport").value = "";
    return;
  }

  const columns = clamp(Number(el("columns").value), 1, 8);
  const lines = [
    el("chartTitle").value.trim() || "Seating Chart",
    "WHITEBOARD / FRONT OF CLASSROOM",
    ""
  ];

  for (let start = 0; start < state.groups.length; start += columns) {
    const row = state.groups.slice(start, start + columns);
    lines.push(row.map((_, offset) => getTableName(start + offset)).join("\t"));

    SUITS.forEach((suit, seatIndex) => {
      lines.push(row.map(group => {
        const student = group[seatIndex];
        return `${suit.symbol} ${suit.label}: ${student ? student.name : "Empty"}`;
      }).join("\t"));
    });
    lines.push("");
  }

  el("slidesExport").value = lines.join("\n");
}

function saveChart() {
  if (!state.groups.some(group => group.length)) {
    setStatus("Shuffle students before saving a chart.");
    return;
  }

  const now = new Date();
  state.savedCharts.unshift({
    id: String(now.getTime()),
    description: el("saveDescription").value.trim() || "Saved seating chart",
    createdAt: now.toISOString(),
    rows: Number(el("rows").value),
    columns: Number(el("columns").value),
    tableNaming: el("tableNaming").value,
    theme: el("theme").value,
    chartTitle: el("chartTitle").value,
    slidesMode: el("slidesMode").checked,
    roster: el("roster").value,
    students: state.students,
    groups: state.groups
  });

  el("saveDescription").value = "";
  persist();
  renderSavedCharts();
  setStatus("Chart saved in this browser.");
}

function restoreChart(chart) {
  el("rows").value = chart.rows;
  el("columns").value = chart.columns;
  el("tableNaming").value = chart.tableNaming;
  el("theme").value = chart.theme;
  el("chartTitle").value = chart.chartTitle;
  el("slidesMode").checked = chart.slidesMode;
  el("roster").value = chart.roster;

  state.students = chart.students;
  state.groups = chart.groups;
  state.students.forEach(student => {
    state.preferences[student.name] = Boolean(student.needsFront);
  });

  renderStudentOptions();
  renderChart();
  persist();
  setStatus(`Opened “${chart.description}.”`);
}

function renderSavedCharts() {
  const container = el("savedCharts");
  container.innerHTML = "";

  if (!state.savedCharts.length) {
    container.innerHTML = '<p class="help">No saved charts yet.</p>';
    return;
  }

  state.savedCharts.forEach(chart => {
    const item = document.createElement("div");
    item.className = "saved-chart";

    const title = document.createElement("strong");
    title.textContent = chart.description;

    const date = document.createElement("small");
    date.textContent = new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
    }).format(new Date(chart.createdAt));

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "button secondary";
    open.textContent = "Open";
    open.addEventListener("click", () => restoreChart(chart));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      state.savedCharts = state.savedCharts.filter(saved => saved.id !== chart.id);
      persist();
      renderSavedCharts();
    });

    actions.append(open, remove);
    item.append(title, date, actions);
    container.appendChild(item);
  });
}

function resetLocalData() {
  const confirmed = window.confirm("Delete all saved rosters, preferences, and seating charts from this browser?");
  if (!confirmed) return;
  localStorage.removeItem("seatMixerState");
  location.reload();
}

function setStatus(message) {
  el("status").textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function bindEvents() {
  el("loadRosterBtn").addEventListener("click", () => loadRoster(true));
  el("shuffleBtn").addEventListener("click", shuffleSeats);
  el("printBtn").addEventListener("click", () => window.print());
  el("saveBtn").addEventListener("click", saveChart);
  el("resetBtn").addEventListener("click", resetLocalData);

  el("selectSlidesBtn").addEventListener("click", () => {
    el("slidesExport").focus();
    el("slidesExport").select();
    setStatus("Slides text selected. Use your normal copy command.");
  });

  ["rows", "columns", "tableNaming", "theme", "slidesMode"].forEach(id => {
    el(id).addEventListener("change", () => {
      state.groups = [];
      renderChart();
      persist();
      setStatus("Layout updated. Roster and front-seat preferences were kept.");
    });
  });

  el("chartTitle").addEventListener("input", () => {
    renderChart();
    persist();
  });
}

loadLocalState();
bindEvents();
loadRoster(false);
renderSavedCharts();
renderChart();

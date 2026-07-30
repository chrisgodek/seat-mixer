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

function clearRoster() {
  const confirmed = window.confirm(
    "Clear the current roster and seating assignments?"
  );

  if (!confirmed) return;

  state.students = [];
  state.groups = [];

  el("roster").value = "";
  el("slidesExport").value = "";

  renderStudentOptions();
  renderChart();
  persist();

  setStatus(
    "Current roster cleared. Saved charts and front-seat preferences were kept."
  );
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
  if (!state.students.length) {
    loadRoster(false);
  }

  if (!state.students.length) {
    setStatus("Paste and load at least one student first.");
    return;
  }

  const rows = clamp(Number(el("rows").value), 1, 8);
  const columns = clamp(Number(el("columns").value), 1, 8);
  const tableCount = rows * columns;
  const capacity = tableCount * 4;
  const studentCount = state.students.length;

  if (studentCount > capacity) {
    setStatus(
      `This room holds ${capacity} students. Add more table groups.`
    );
    return;
  }

  /*
   * Rosters of 1, 2, or 5 cannot be divided into
   * occupied tables containing only 3 or 4 students.
   */
  if (studentCount < 3 || studentCount === 5) {
    setStatus(
      "This roster size cannot be divided into tables of at least three students."
    );
    return;
  }

  const frontStudents = shuffle(
    state.students.filter(student => student.needsFront)
  );

  const otherStudents = shuffle(
    state.students.filter(student => !student.needsFront)
  );

  /*
   * Determine the fewest tables needed when each table
   * may contain no more than four students.
   */
  const occupiedTableCount = Math.ceil(studentCount / 4);

  /*
   * Start with four students at every occupied table.
   * Change tables at the back into groups of three
   * until the total matches the roster.
   *
   * Examples:
   * 14 students → 4, 4, 3, 3
   * 15 students → 4, 4, 4, 3
   * 16 students → 4, 4, 4, 4
   */
  const tableSizes = Array(occupiedTableCount).fill(4);
  let seatsToRemove = occupiedTableCount * 4 - studentCount;

  for (
    let tableIndex = occupiedTableCount - 1;
    tableIndex >= 0 && seatsToRemove > 0;
    tableIndex--
  ) {
    tableSizes[tableIndex] = 3;
    seatsToRemove--;
  }

  /*
   * Create every table in the classroom.
   * Tables after the occupied tables remain fully empty.
   */
  state.groups = Array.from(
    { length: tableCount },
    () => Array(4).fill(null)
  );

  /*
   * Build the usable seat locations.
   * Full tables use all four suits.
   * Groups of three leave one randomly selected suit empty.
   */
  const availableSeats = [];

  tableSizes.forEach((tableSize, tableIndex) => {
    const seatIndexes = shuffle([0, 1, 2, 3]).slice(0, tableSize);

    seatIndexes.forEach(seatIndex => {
      availableSeats.push({
        tableIndex,
        seatIndex
      });
    });
  });

  /*
   * Front-priority students may sit at any occupied seat
   * among the tables in the first classroom row.
   */
  const frontRowSeats = shuffle(
    availableSeats.filter(location =>
      location.tableIndex < columns
    )
  );

  if (frontStudents.length > frontRowSeats.length) {
    setStatus(
      `There are ${frontStudents.length} front-seat students, but only ` +
      `${frontRowSeats.length} occupied seats in the front row.`
    );
    return;
  }

  /*
   * Assign front-priority students first.
   */
  frontStudents.forEach((student, index) => {
    const location = frontRowSeats[index];

    state.groups[location.tableIndex][location.seatIndex] = student;
  });

  /*
   * Collect all remaining usable seats and randomly
   * place the other students into them.
   */
  const remainingSeats = shuffle(
    availableSeats.filter(location =>
      !state.groups[location.tableIndex][location.seatIndex]
    )
  );

  otherStudents.forEach((student, index) => {
    const location = remainingSeats[index];

    if (!location) return;

    state.groups[location.tableIndex][location.seatIndex] = student;
  });

  renderChart();
  persist();

  setStatus(
    `${studentCount} students shuffled into ` +
    `${occupiedTableCount} occupied table(s). ` +
    `Group sizes: ${tableSizes.join(", ")}.`
  );
}

/*
 * Begin with four students at every occupied table.
 * Any necessary groups of three are placed at the back of the room.
 *
 * Example:
 * 14 students → [4, 4, 3, 3]
 * 15 students → [4, 4, 4, 3]
 * 16 students → [4, 4, 4, 4]
 */
const tableSizes = Array(occupiedTableCount).fill(4);
let seatsToRemove = occupiedTableCount * 4 - state.students.length;

for (
  let tableIndex = occupiedTableCount - 1;
  tableIndex >= 0 && seatsToRemove > 0;
  tableIndex--
) {
  tableSizes[tableIndex] = 3;
  seatsToRemove--;
}

/*
 * Create every classroom table.
 * Tables beyond occupiedTableCount remain completely empty.
 */
state.groups = Array.from(
  { length: tableCount },
  () => Array(4).fill(null)
);

/*
 * Build the available seat locations for occupied tables only.
 */
const availableSeats = [];

tableSizes.forEach((tableSize, tableIndex) => {
  const seatIndexes = shuffle([0, 1, 2, 3]).slice(0, tableSize);

  seatIndexes.forEach(seatIndex => {
    availableSeats.push({
      tableIndex,
      seatIndex
    });
  });
});

/*
 * Front-priority students may use any available seat
 * in the first row of occupied tables.
 */
const frontRowSeats = shuffle(
  availableSeats.filter(location =>
    location.tableIndex < columns
  )
);

if (frontStudents.length > frontRowSeats.length) {
  setStatus(
    `There are ${frontStudents.length} front-seat students, but only ` +
    `${frontRowSeats.length} occupied seats in the front row.`
  );
  return;
}

/*
 * Assign front-priority students first.
 */
frontStudents.forEach((student, index) => {
  const location = frontRowSeats[index];

  state.groups[location.tableIndex][location.seatIndex] = student;
});

/*
 * Remove seats already assigned to front-priority students.
 */
const remainingSeats = shuffle(
  availableSeats.filter(location =>
    !state.groups[location.tableIndex][location.seatIndex]
  )
);

/*
 * Assign all remaining students.
 */
otherStudents.forEach((student, index) => {
  const location = remainingSeats[index];

  if (!location) return;

  state.groups[location.tableIndex][location.seatIndex] = student;
});
const frontTableIndexes = shuffle(
  Array.from({ length: columns }, (_, index) => index)
);

const seatIndexes = shuffle([0, 1, 2, 3]);

const shuffledFrontSeats = [];

/*
 * Build the seat order so each front table gets one
 * student before any table gets a second.
 */
seatIndexes.forEach(seatIndex => {
  frontTableIndexes.forEach(tableIndex => {
    shuffledFrontSeats.push({
      tableIndex,
      seatIndex
    });
  });
});

  /*
   * Assign front-priority students randomly among the front-row seats.
   */
  frontStudents.forEach((student, index) => {
    const location = shuffledFrontSeats[index];

    if (!location) return;

    state.groups[location.tableIndex][location.seatIndex] = student;
  });

  /*
   * Build a list of every remaining empty seat in the classroom.
   */
  const remainingSeatLocations = [];

  state.groups.forEach((group, tableIndex) => {
    group.forEach((student, seatIndex) => {
      if (!student) {
        remainingSeatLocations.push({
          tableIndex,
          seatIndex
        });
      }
    });
  });

  const shuffledRemainingSeats = shuffle(remainingSeatLocations);

  /*
   * Randomly place all other students into the remaining seats.
   */
  otherStudents.forEach((student, index) => {
    const location = shuffledRemainingSeats[index];

    if (!location) return;

    state.groups[location.tableIndex][location.seatIndex] = student;
  });

  renderChart();
  persist();

  const groupSummary = tableSizes.join(", ");

  setStatus(
    `${state.students.length} students shuffled into ` +
    `${occupiedTableCount} occupied table(s). ` +
    `Group sizes: ${groupSummary}.`
  );
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
    tableLabel.innerHTML = `<span>${escapeHtml(getTableName(i))}</span>`;

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
  el("clearRosterBtn").addEventListener("click", clearRoster);
  
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

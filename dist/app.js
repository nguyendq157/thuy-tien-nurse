"use strict";
const STORAGE_KEY = "ttn-nurse-state-v1";
const SOON_MINUTES = 60;
const SHIFT_DEFS = [
    { key: "sang", label: "Ca Sáng", range: "07:00 - 14:00" },
    { key: "chieu", label: "Ca Chiều", range: "14:00 - 21:00" },
    { key: "dem", label: "Ca Đêm", range: "21:00 - 07:00" },
];
const LEVEL_LABEL = { normal: "Bình thường", attention: "Cần chú ý", high: "Ưu tiên cao" };
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
function toISO(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}
function fromISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
}
function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
}
function formatVN(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}
function mondayOf(iso) {
    const d = fromISO(iso);
    return addDays(iso, -((d.getDay() + 6) % 7));
}
function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}
function currentShiftKey(now) {
    const h = now.getHours();
    if (h >= 7 && h < 14)
        return "sang";
    if (h >= 14 && h < 21)
        return "chieu";
    return "dem";
}
function shiftOfTime(hhmm) {
    return currentShiftKey(new Date(2000, 0, 1, Math.floor(timeToMinutes(hhmm) / 60), 0));
}
function uid() {
    return Math.random().toString(36).slice(2, 10);
}
function buildSampleState() {
    const nurses = [
        { id: "n1", name: "Nguyễn Thị Lan" },
        { id: "n2", name: "Trần Văn Hùng" },
        { id: "n3", name: "Lê Thị Mai" },
    ];
    const patients = [
        { id: "p1", bed: "P101-G1", name: "Phạm Văn Bình (đột quỵ, liệt nửa người)", level: "high", nurseId: "n1" },
        { id: "p2", bed: "P101-G2", name: "Đỗ Thị Hoa (sau mổ thay khớp gối)", level: "attention", nurseId: "n1" },
        { id: "p3", bed: "P102-G1", name: "Vũ Minh Tuấn (chấn thương tủy sống)", level: "high", nurseId: "n2" },
        { id: "p4", bed: "P102-G2", name: "Hoàng Thị Nga (thoái hóa cột sống)", level: "normal", nurseId: "n2" },
        { id: "p5", bed: "P103-G1", name: "Bùi Quang Dũng (liệt dây VII)", level: "normal", nurseId: "n3" },
        { id: "p6", bed: "P103-G2", name: "Ngô Thị Thu (gãy xương đùi, bó bột)", level: "attention", nurseId: "n3" },
    ];
    const meds = [
        { id: "m1", patientId: "p1", time: "08:00", drug: "Aspirin", dose: "81mg, uống" },
        { id: "m2", patientId: "p1", time: "12:00", drug: "Atorvastatin", dose: "20mg, uống" },
        { id: "m3", patientId: "p1", time: "20:00", drug: "Amlodipin", dose: "5mg, uống" },
        { id: "m4", patientId: "p2", time: "08:00", drug: "Paracetamol", dose: "500mg, uống" },
        { id: "m5", patientId: "p2", time: "16:00", drug: "Enoxaparin", dose: "40mg, tiêm dưới da" },
        { id: "m6", patientId: "p3", time: "08:00", drug: "Baclofen", dose: "10mg, uống" },
        { id: "m7", patientId: "p3", time: "12:00", drug: "Methylprednisolon", dose: "16mg, uống" },
        { id: "m8", patientId: "p3", time: "20:00", drug: "Gabapentin", dose: "300mg, uống" },
        { id: "m9", patientId: "p4", time: "12:00", drug: "Meloxicam", dose: "7.5mg, uống" },
        { id: "m10", patientId: "p5", time: "08:00", drug: "Prednisolon", dose: "20mg, uống" },
        { id: "m11", patientId: "p5", time: "16:00", drug: "Vitamin B1-B6-B12", dose: "1 viên, uống" },
        { id: "m12", patientId: "p6", time: "08:00", drug: "Canxi + D3", dose: "1 viên, uống" },
        { id: "m13", patientId: "p6", time: "16:00", drug: "Tramadol", dose: "50mg, uống" },
    ];
    const today = toISO(new Date());
    const shifts = [
        { date: today, shift: "sang", nurseIds: ["n1", "n2"], note: "Giường P101-G1 theo dõi huyết áp mỗi 2 giờ." },
        { date: today, shift: "chieu", nurseIds: ["n3", "n2"], note: "" },
        { date: today, shift: "dem", nurseIds: ["n1"], note: "" },
    ];
    return { nurses, patients, meds, shifts, done: {}, sheetUrl: "", scriptUrl: "", scriptToken: "" };
}
let state = loadState();
let activeTab = "shifts";
let shiftView = "day";
let selectedDate = toISO(new Date());
let filterNurse = "";
let filterLevel = "";
let editingPatientId = null;
let editingMedId = null;
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw)
            return { ...buildSampleState(), ...JSON.parse(raw) };
    }
    catch {
    }
    return buildSampleState();
}
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function $(id) {
    return document.getElementById(id);
}
function esc(text) {
    return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function nurseName(id) {
    return state.nurses.find((n) => n.id === id)?.name ?? "Chưa phân công";
}
function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    window.setTimeout(() => el.classList.remove("show"), 2200);
}
function getShiftEntry(date, shift) {
    let entry = state.shifts.find((s) => s.date === date && s.shift === shift);
    if (!entry) {
        entry = { date, shift, nurseIds: [], note: "" };
        state.shifts.push(entry);
    }
    return entry;
}
function findShiftEntry(date, shift) {
    return state.shifts.find((s) => s.date === date && s.shift === shift);
}
function doneKey(medId, date) {
    return `${medId}|${date}`;
}
function medStatus(med, date, now) {
    if (state.done[doneKey(med.id, date)])
        return "done";
    const today = toISO(now);
    if (date < today)
        return "late";
    if (date > today)
        return "upcoming";
    const diff = timeToMinutes(med.time) - (now.getHours() * 60 + now.getMinutes());
    if (diff < 0)
        return "late";
    if (diff <= SOON_MINUTES)
        return "soon";
    return "upcoming";
}
const STATUS_LABEL = { done: "Đã thực hiện", late: "TRỄ", soon: "Sắp đến giờ", upcoming: "" };
function render() {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === activeTab));
    const view = $("view");
    if (activeTab === "shifts")
        view.innerHTML = shiftView === "day" ? renderDay() : renderWeek();
    else if (activeTab === "patients")
        view.innerHTML = renderPatients();
    else
        view.innerHTML = renderMeds();
}
function dateToolbar() {
    return `
    <div class="toolbar">
      <div class="seg">
        <button class="${shiftView === "day" ? "active" : ""}" data-action="view" data-view="day">Ngày</button>
        <button class="${shiftView === "week" ? "active" : ""}" data-action="view" data-view="week">Tuần</button>
      </div>
      <button class="btn" data-action="date-prev">◀</button>
      <input type="date" value="${selectedDate}" data-change="date" />
      <button class="btn" data-action="date-next">▶</button>
      <button class="btn" data-action="date-today">Hôm nay</button>
    </div>`;
}
function renderDay() {
    const now = new Date();
    const isToday = selectedDate === toISO(now);
    const nowShift = currentShiftKey(now);
    const cards = SHIFT_DEFS.map((def) => {
        const entry = findShiftEntry(selectedDate, def.key);
        const ids = entry?.nurseIds ?? [];
        const chips = ids.length
            ? ids.map((id) => `<span class="chip">${esc(nurseName(id))}<button title="Xóa" data-action="remove-shift-nurse" data-shift="${def.key}" data-id="${id}">×</button></span>`).join("")
            : `<span class="empty">Chưa có điều dưỡng</span>`;
        const options = state.nurses
            .filter((n) => !ids.includes(n.id))
            .map((n) => `<option value="${n.id}">${esc(n.name)}</option>`)
            .join("");
        return `
      <div class="card shift-card ${isToday && nowShift === def.key ? "current" : ""}">
        <h3>${def.label}</h3>
        <div class="range">${def.range}</div>
        <div class="chips">${chips}</div>
        <select data-change="add-shift-nurse" data-shift="${def.key}">
          <option value="">+ Thêm điều dưỡng…</option>${options}
        </select>
        <textarea placeholder="Ghi chú bàn giao cuối ca…" data-change="shift-note" data-shift="${def.key}">${esc(entry?.note ?? "")}</textarea>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" data-action="copy-handover" data-shift="${def.key}">📋 Sao chép tóm tắt bàn giao</button>
        </div>
      </div>`;
    }).join("");
    return `${dateToolbar()}<div class="shift-grid">${cards}</div>`;
}
function renderWeek() {
    const monday = mondayOf(selectedDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const today = toISO(new Date());
    const head = days.map((d, i) => `<th class="${d === today ? "week-today" : ""}">${WEEKDAYS[i]}<br /><small>${formatVN(d).slice(0, 5)}</small></th>`).join("");
    const rows = SHIFT_DEFS.map((def) => {
        const cells = days
            .map((d) => {
            const names = (findShiftEntry(d, def.key)?.nurseIds ?? []).map((id) => esc(nurseName(id))).join("<br />");
            return `<td class="week-cell ${d === today ? "week-today" : ""}" data-action="goto-day" data-date="${d}">${names || '<span class="empty">—</span>'}</td>`;
        })
            .join("");
        return `<tr><th>${def.label}<br /><small>${def.range}</small></th>${cells}</tr>`;
    }).join("");
    return `${dateToolbar()}<div class="table-wrap"><table><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Bấm vào một ô để mở ngày đó và chỉnh sửa.</p>`;
}
function filterBar(extra) {
    const nurseOpts = state.nurses.map((n) => `<option value="${n.id}" ${filterNurse === n.id ? "selected" : ""}>${esc(n.name)}</option>`).join("");
    const levelOpts = Object.keys(LEVEL_LABEL).map((l) => `<option value="${l}" ${filterLevel === l ? "selected" : ""}>${LEVEL_LABEL[l]}</option>`).join("");
    return `
    <div class="toolbar">
      <select data-change="filter-nurse"><option value="">Tất cả điều dưỡng</option>${nurseOpts}</select>
      <select data-change="filter-level"><option value="">Mọi mức độ</option>${levelOpts}</select>
      <span class="spacer"></span>
      ${extra}
    </div>`;
}
function filteredPatients() {
    return state.patients.filter((p) => (!filterNurse || p.nurseId === filterNurse) && (!filterLevel || p.level === filterLevel));
}
function renderPatients() {
    const list = filteredPatients();
    const cards = list
        .map((p) => {
        const medCount = state.meds.filter((m) => m.patientId === p.id).length;
        return `
      <div class="card patient-card ${p.level === "high" ? "lv-high-b" : p.level === "attention" ? "lv-attention-b" : ""}">
        <div class="bed">🛏 ${esc(p.bed)}</div>
        <div class="pname">${esc(p.name)}</div>
        <span class="badge lv-${p.level}">${LEVEL_LABEL[p.level]}</span>
        <div class="meta">ĐD phụ trách: <b>${esc(nurseName(p.nurseId))}</b> · ${medCount} cữ thuốc</div>
        <div class="card-actions">
          <button class="btn btn-sm" data-action="edit-patient" data-id="${p.id}">Sửa</button>
          <button class="btn btn-sm btn-danger" data-action="delete-patient" data-id="${p.id}">Xóa</button>
        </div>
      </div>`;
    })
        .join("");
    return `${filterBar(`<button class="btn btn-primary" data-action="add-patient">+ Thêm bệnh nhân</button>`)}
    <div class="grid">${cards || '<p class="empty">Không có bệnh nhân phù hợp.</p>'}</div>`;
}
function renderMeds() {
    const now = new Date();
    const patientIds = new Set(filteredPatients().map((p) => p.id));
    const rows = state.meds
        .filter((m) => patientIds.has(m.patientId))
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((m) => {
        const p = state.patients.find((x) => x.id === m.patientId);
        if (!p)
            return "";
        const status = medStatus(m, selectedDate, now);
        const isDone = status === "done";
        return `
      <div class="med-row ${status} med-lv-${p.level}">
        <input type="checkbox" ${isDone ? "checked" : ""} data-change="toggle-med" data-id="${m.id}" title="Đã thực hiện" />
        <div class="med-time">${m.time}</div>
        <div>
          <div class="drug">${esc(m.drug)} <span class="sub">${esc(m.dose)}</span></div>
          <div class="sub"><span class="badge lv-${p.level}">${LEVEL_LABEL[p.level]}</span> ${esc(p.bed)} · ${esc(p.name)} · ĐD: ${esc(nurseName(p.nurseId))} ${STATUS_LABEL[status] ? `· <b>${STATUS_LABEL[status]}</b>` : ""}</div>
        </div>
        <div class="med-actions">
          <button class="btn btn-sm" data-action="edit-med" data-id="${m.id}">Sửa</button>
          <button class="btn btn-sm btn-danger" data-action="delete-med" data-id="${m.id}">Xóa</button>
        </div>
      </div>`;
    })
        .join("");
    const bar = `
    <div class="toolbar">
      <button class="btn" data-action="med-date-prev">◀</button>
      <input type="date" value="${selectedDate}" data-change="date" />
      <button class="btn" data-action="med-date-next">▶</button>
      <button class="btn" data-action="date-today">Hôm nay</button>
    </div>`;
    return `${bar}${filterBar(`<button class="btn btn-primary" data-action="add-med">+ Thêm cữ thuốc</button>`)}
    ${rows || '<p class="empty">Chưa có cữ thuốc nào.</p>'}`;
}
function buildHandover(date, shift) {
    const def = SHIFT_DEFS.find((s) => s.key === shift);
    const entry = findShiftEntry(date, shift);
    const now = new Date();
    const lines = [];
    lines.push(`BÀN GIAO ${def.label.toUpperCase()} - ${formatVN(date)} (${def.range})`);
    lines.push(`Điều dưỡng: ${entry?.nurseIds.length ? entry.nurseIds.map(nurseName).join(", ") : "(chưa phân công)"}`);
    if (entry?.note.trim())
        lines.push(`Ghi chú: ${entry.note.trim()}`);
    lines.push("", "BỆNH NHÂN:");
    const patients = [...state.patients].sort((a, b) => nurseName(a.nurseId).localeCompare(nurseName(b.nurseId)));
    for (const p of patients) {
        const flag = p.level === "high" ? " ⚠ ƯU TIÊN CAO" : p.level === "attention" ? " ! Cần chú ý" : "";
        lines.push(`- ${p.bed} | ${p.name}${flag} | ĐD: ${nurseName(p.nurseId)}`);
        const pending = state.meds
            .filter((m) => m.patientId === p.id && shiftOfTime(m.time) === shift && medStatus(m, date, now) !== "done")
            .sort((a, b) => a.time.localeCompare(b.time));
        for (const m of pending) {
            const late = medStatus(m, date, now) === "late" ? " (TRỄ)" : "";
            lines.push(`    • Chưa thực hiện: ${m.time} ${m.drug} ${m.dose}${late}`);
        }
    }
    return lines.join("\n");
}
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
    }
    catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
    }
    toast("Đã sao chép tóm tắt bàn giao");
}
function dlg(id) {
    return $(id);
}
function nurseOptions(selected) {
    return `<option value="">— Chưa phân công —</option>` + state.nurses.map((n) => `<option value="${n.id}" ${n.id === selected ? "selected" : ""}>${esc(n.name)}</option>`).join("");
}
function openPatientDialog(id) {
    editingPatientId = id;
    const p = state.patients.find((x) => x.id === id);
    const form = $("form-patient");
    form.elements.namedItem("bed").value = p?.bed ?? "";
    form.elements.namedItem("name").value = p?.name ?? "";
    form.elements.namedItem("level").value = p?.level ?? "normal";
    const sel = form.elements.namedItem("nurseId");
    sel.innerHTML = nurseOptions(p?.nurseId ?? "");
    $("dlg-patient-title").textContent = p ? "Sửa thẻ bệnh nhân" : "Thêm bệnh nhân";
    dlg("dlg-patient").showModal();
}
function openMedDialog(id) {
    if (!state.patients.length) {
        toast("Hãy thêm bệnh nhân trước");
        return;
    }
    editingMedId = id;
    const m = state.meds.find((x) => x.id === id);
    const form = $("form-med");
    const sel = form.elements.namedItem("patientId");
    sel.innerHTML = state.patients.map((p) => `<option value="${p.id}">${esc(p.bed)} - ${esc(p.name)}</option>`).join("");
    sel.value = m?.patientId ?? state.patients[0].id;
    form.elements.namedItem("time").value = m?.time ?? "08:00";
    form.elements.namedItem("drug").value = m?.drug ?? "";
    form.elements.namedItem("dose").value = m?.dose ?? "";
    $("dlg-med-title").textContent = m ? "Sửa cữ thuốc" : "Thêm cữ thuốc";
    dlg("dlg-med").showModal();
}
function renderNurseDialog() {
    $("nurse-list").innerHTML = state.nurses
        .map((n) => `<div class="nurse-row">
        <input value="${esc(n.name)}" data-change="rename-nurse" data-id="${n.id}" />
        <button class="btn btn-danger btn-sm" data-action="delete-nurse" data-id="${n.id}">Xóa</button>
      </div>`)
        .join("");
}
function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else if (c === '"')
                inQuotes = false;
            else
                cell += c;
        }
        else if (c === '"')
            inQuotes = true;
        else if (c === ",") {
            row.push(cell);
            cell = "";
        }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n")
                i++;
            row.push(cell);
            cell = "";
            rows.push(row);
            row = [];
        }
        else
            cell += c;
    }
    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
function normalizeKey(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function rowsToRecords(rows, required) {
    if (!rows.length)
        return null;
    const headers = rows[0].map((h) => normalizeKey(String(h)));
    if (!required.every((r) => headers.includes(r)))
        return null;
    return rows
        .slice(1)
        .filter((r) => r.some((x) => String(x).trim() !== ""))
        .map((r) => {
        const rec = {};
        headers.forEach((h, i) => (rec[h] = String(r[i] ?? "").trim()));
        return rec;
    });
}
async function fetchCsvTab(url, tab, required) {
    const bust = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
    const res = await fetch(bust, { cache: "no-store" });
    if (!res.ok)
        throw new Error(`Không tải được tab ${tab} (HTTP ${res.status})`);
    return rowsToRecords(parseCSV(await res.text()), required);
}
function parseLevel(text) {
    const k = normalizeKey(text);
    if (k.includes("uu_tien") || k.includes("cao"))
        return "high";
    if (k.includes("chu_y"))
        return "attention";
    return "normal";
}
function parseSheetDate(text) {
    const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m)
        return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return text;
}
function parseShiftKey(text) {
    const k = normalizeKey(text);
    if (k.includes("sang"))
        return "sang";
    if (k.includes("chieu"))
        return "chieu";
    if (k.includes("dem"))
        return "dem";
    return null;
}
async function resolvePublishedSource(urlText) {
    const published = urlText.match(/\/d\/e\/([a-zA-Z0-9_-]+)/);
    if (published) {
        const base = `https://docs.google.com/spreadsheets/d/e/${published[1]}`;
        const res = await fetch(`${base}/pubhtml?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok)
            throw new Error(`Không mở được trang xuất bản (HTTP ${res.status})`);
        const html = await res.text();
        const gids = new Map();
        for (const m of html.matchAll(/name:\s*"([^"]+)"[^}]*?gid:\s*"(\d+)"/g))
            gids.set(normalizeKey(m[1]), m[2]);
        if (!gids.size)
            throw new Error("Không đọc được danh sách tab từ trang xuất bản");
        return {
            read: async (tab, required) => {
                const gid = gids.get(normalizeKey(tab));
                return gid ? fetchCsvTab(`${base}/pub?gid=${gid}&single=true&output=csv`, tab, required) : null;
            },
        };
    }
    const shared = urlText.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!shared)
        throw new Error("Đường dẫn Google Sheet không hợp lệ");
    return { read: (tab, required) => fetchCsvTab(`https://docs.google.com/spreadsheets/d/${shared[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`, tab, required) };
}
async function callScript(action, tabs) {
    const res = await fetch(state.scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, token: state.scriptToken, tabs }),
    });
    if (!res.ok)
        throw new Error(`Apps Script trả về HTTP ${res.status}`);
    const data = (await res.json());
    if (!data.ok)
        throw new Error(data.error ?? "Apps Script báo lỗi");
    return data.tabs ?? {};
}
async function scriptSource() {
    const tabs = await callScript("pull");
    return { read: async (tab, required) => rowsToRecords(tabs[tab] ?? [], required) };
}
function buildPushTabs() {
    const bedOf = (patientId) => state.patients.find((p) => p.id === patientId)?.bed ?? "";
    const shiftLabel = (key) => SHIFT_DEFS.find((d) => d.key === key).label;
    return {
        DieuDuong: [["ten"], ...state.nurses.map((n) => [n.name])],
        BenhNhan: [
            ["giuong", "ten", "muc_do", "dieu_duong"],
            ...state.patients.map((p) => [p.bed, p.name, LEVEL_LABEL[p.level], p.nurseId ? nurseName(p.nurseId) : ""]),
        ],
        Thuoc: [["giuong", "gio", "thuoc", "lieu"], ...state.meds.map((m) => [bedOf(m.patientId), m.time, m.drug, m.dose])],
        Ca: [
            ["ngay", "ca", "dieu_duong", "ghi_chu"],
            ...state.shifts
                .filter((sh) => sh.nurseIds.length || sh.note.trim())
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((sh) => [sh.date, shiftLabel(sh.shift), sh.nurseIds.map(nurseName).join(", "), sh.note]),
        ],
    };
}
let syncReady = false;
let pushing = false;
let pushQueued = false;
function setSyncStatus(text) {
    $("sync-status").textContent = text;
}
function setLoading(visible) {
    const dialog = dlg("dlg-loading");
    if (visible && !dialog.open)
        dialog.showModal();
    if (!visible && dialog.open)
        dialog.close();
}
async function pushToSheet() {
    if (pushing) {
        pushQueued = true;
        return;
    }
    pushing = true;
    setLoading(true);
    setSyncStatus("☁ Đang lưu lên Sheet…");
    try {
        await callScript("push", buildPushTabs());
        setSyncStatus("☁ Đã lưu lên Sheet");
    }
    catch (err) {
        setSyncStatus("⚠ Lưu Sheet thất bại");
        toast(`Không lưu được lên Sheet: ${err instanceof Error ? err.message : String(err)}`);
    }
    finally {
        pushing = false;
        setLoading(false);
        if (pushQueued) {
            pushQueued = false;
            void pushToSheet();
        }
    }
}
async function importFromSheet() {
    const useScript = Boolean(state.scriptUrl && state.scriptToken);
    const source = useScript ? await scriptSource() : await resolvePublishedSource(state.sheetUrl);
    const [nurseRows, patientRows, medRows, shiftRows] = await Promise.all([
        source.read("DieuDuong", ["ten"]),
        source.read("BenhNhan", ["giuong", "ten"]),
        source.read("Thuoc", ["giuong", "gio", "thuoc"]),
        source.read("Ca", ["ngay", "ca"]),
    ]);
    if (!patientRows)
        throw new Error("Không tìm thấy tab BenhNhan với cột giuong, ten");
    const nurses = [];
    const nurseByName = (name) => {
        const key = normalizeKey(name);
        if (!key)
            return "";
        let n = nurses.find((x) => normalizeKey(x.name) === key);
        if (!n) {
            n = { id: uid(), name: name.trim() };
            nurses.push(n);
        }
        return n.id;
    };
    (nurseRows ?? []).forEach((r) => nurseByName(r.ten));
    const patients = patientRows.map((r) => ({
        id: uid(), bed: r.giuong, name: r.ten, level: parseLevel(r.muc_do ?? ""), nurseId: nurseByName(r.dieu_duong ?? ""),
    }));
    const meds = [];
    for (const r of medRows ?? []) {
        const p = patients.find((x) => normalizeKey(x.bed) === normalizeKey(r.giuong));
        const time = (r.gio ?? "").match(/^(\d{1,2}):(\d{2})/);
        if (p && time)
            meds.push({ id: uid(), patientId: p.id, time: `${time[1].padStart(2, "0")}:${time[2]}`, drug: r.thuoc, dose: r.lieu ?? "" });
    }
    const shifts = [];
    for (const r of shiftRows ?? []) {
        const key = parseShiftKey(r.ca);
        if (!key)
            continue;
        const date = parseSheetDate(r.ngay);
        let entry = shifts.find((s) => s.date === date && s.shift === key);
        if (!entry) {
            entry = { date, shift: key, nurseIds: [], note: "" };
            shifts.push(entry);
        }
        r.dieu_duong?.split(/[,;]/).forEach((name) => {
            const nid = nurseByName(name);
            if (nid && !entry.nurseIds.includes(nid))
                entry.nurseIds.push(nid);
        });
        if (r.ghi_chu)
            entry.note = r.ghi_chu;
    }
    if (!patients.length)
        throw new Error("Tab BenhNhan chưa có dòng dữ liệu nào (chỉ có tiêu đề). Dữ liệu hiện tại được giữ nguyên");
    state = { ...state, nurses, patients, meds, shifts: shiftRows ? shifts : state.shifts };
    saveState();
    if (useScript) {
        syncReady = true;
        setSyncStatus("☁ Đã đồng bộ với Sheet");
    }
    return `Đã tải ${nurses.length} điều dưỡng, ${patients.length} bệnh nhân, ${meds.length} cữ thuốc${useScript ? " (dữ liệu mới nhất từ Sheet)" : ""}.`;
}
function isSyncActive() {
    return Boolean(state.scriptUrl && state.scriptToken && syncReady);
}
function askConfirm(title, lines, okLabel) {
    const dialog = dlg("dlg-confirm");
    $("confirm-title").textContent = title;
    const list = $("confirm-lines");
    list.innerHTML = "";
    lines.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        list.appendChild(li);
    });
    $("confirm-ok").textContent = okLabel;
    dialog.returnValue = "";
    return new Promise((resolve) => {
        dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
        dialog.showModal();
    });
}
async function commitChange(lines, apply, destructive = false) {
    const syncing = isSyncActive();
    if (syncing || destructive) {
        const title = syncing ? "Xác nhận lưu lên Google Sheet" : "Xác nhận xóa";
        const okLabel = syncing ? "Đồng ý lưu" : "Đồng ý xóa";
        const body = syncing ? ["Nội dung sau sẽ được lưu lên Google Sheet:", ...lines] : lines;
        if (!(await askConfirm(title, body, okLabel)))
            return false;
    }
    apply();
    saveState();
    if (syncing)
        await pushToSheet();
    render();
    return true;
}
function shiftTitle(shift) {
    const def = SHIFT_DEFS.find((d) => d.key === shift);
    return `${def.label} ${formatVN(selectedDate)}`;
}
function describePatient(data) {
    return [
        `Giường/Phòng: ${data.bed}`,
        `Bệnh nhân: ${data.name}`,
        `Mức độ: ${LEVEL_LABEL[data.level]}`,
        `Điều dưỡng: ${data.nurseId ? nurseName(data.nurseId) : "Chưa phân công"}`,
    ];
}
function el(target) {
    return target instanceof HTMLElement ? target : null;
}
document.addEventListener("click", (e) => {
    const t = el(e.target)?.closest("[data-action]");
    if (!t)
        return;
    const { action, id, shift, date, tab, view } = t.dataset;
    switch (action) {
        case "tab":
            activeTab = tab;
            break;
        case "view":
            shiftView = view;
            break;
        case "date-prev":
            selectedDate = addDays(selectedDate, shiftView === "week" ? -7 : -1);
            break;
        case "date-next":
            selectedDate = addDays(selectedDate, shiftView === "week" ? 7 : 1);
            break;
        case "med-date-prev":
            selectedDate = addDays(selectedDate, -1);
            break;
        case "med-date-next":
            selectedDate = addDays(selectedDate, 1);
            break;
        case "date-today":
            selectedDate = toISO(new Date());
            break;
        case "goto-day":
            selectedDate = date;
            shiftView = "day";
            break;
        case "remove-shift-nurse":
            void commitChange([`${shiftTitle(shift)}: gỡ điều dưỡng ${nurseName(id)}`], () => {
                const entry = getShiftEntry(selectedDate, shift);
                entry.nurseIds = entry.nurseIds.filter((n) => n !== id);
            });
            return;
        case "copy-handover":
            void copyText(buildHandover(selectedDate, shift));
            return;
        case "add-patient":
            openPatientDialog(null);
            return;
        case "edit-patient":
            openPatientDialog(id);
            return;
        case "delete-patient": {
            const p = state.patients.find((x) => x.id === id);
            if (!p)
                return;
            const medCount = state.meds.filter((m) => m.patientId === id).length;
            void commitChange([`Xóa bệnh nhân ${p.bed} - ${p.name}`, `Xóa kèm ${medCount} cữ thuốc của bệnh nhân này`], () => {
                state.patients = state.patients.filter((x) => x.id !== id);
                state.meds = state.meds.filter((m) => m.patientId !== id);
            }, true);
            return;
        }
        case "add-med":
            openMedDialog(null);
            return;
        case "edit-med":
            openMedDialog(id);
            return;
        case "delete-med": {
            const m = state.meds.find((x) => x.id === id);
            if (!m)
                return;
            const p = state.patients.find((x) => x.id === m.patientId);
            void commitChange([`Xóa cữ thuốc ${m.time} ${m.drug} ${m.dose} của ${p ? `${p.bed} - ${p.name}` : "bệnh nhân"}`], () => {
                state.meds = state.meds.filter((x) => x.id !== id);
            }, true);
            return;
        }
        case "open-nurses":
            renderNurseDialog();
            dlg("dlg-nurses").showModal();
            return;
        case "delete-nurse": {
            const n = state.nurses.find((x) => x.id === id);
            if (!n)
                return;
            void commitChange([`Xóa điều dưỡng ${n.name}`, "Họ sẽ bị gỡ khỏi các ca trực và các bệnh nhân đang phụ trách"], () => {
                state.nurses = state.nurses.filter((x) => x.id !== id);
                state.shifts.forEach((sh) => (sh.nurseIds = sh.nurseIds.filter((nid) => nid !== id)));
                state.patients.forEach((pt) => { if (pt.nurseId === id)
                    pt.nurseId = ""; });
                if (filterNurse === id)
                    filterNurse = "";
                renderNurseDialog();
            }, true);
            return;
        }
        case "open-settings": {
            const sf = $("form-settings");
            sf.elements.namedItem("url").value = state.sheetUrl;
            sf.elements.namedItem("scriptUrl").value = state.scriptUrl;
            sf.elements.namedItem("scriptToken").value = state.scriptToken;
            $("settings-status").textContent = "";
            dlg("dlg-settings").showModal();
            return;
        }
        case "reset-sample":
            if (!confirm("Xóa dữ liệu hiện tại trong app và quay về dữ liệu mẫu? (Không ghi lên Sheet)"))
                return;
            state = { ...buildSampleState(), sheetUrl: state.sheetUrl, scriptUrl: state.scriptUrl, scriptToken: state.scriptToken };
            saveState();
            dlg("dlg-settings").close();
            break;
        case "push-sheet":
            void pushNow();
            return;
        case "close-dialog":
            t.closest("dialog")?.close();
            return;
        default: return;
    }
    render();
});
document.addEventListener("change", (e) => {
    const t = el(e.target);
    const kind = t?.dataset.change;
    if (!t || !kind)
        return;
    const shift = t.dataset.shift;
    switch (kind) {
        case "date":
            if (t.value)
                selectedDate = t.value;
            break;
        case "filter-nurse":
            filterNurse = t.value;
            break;
        case "filter-level":
            filterLevel = t.value;
            break;
        case "add-shift-nurse": {
            const nurseId = t.value;
            if (!nurseId)
                return;
            void commitChange([`${shiftTitle(shift)}: thêm điều dưỡng ${nurseName(nurseId)}`], () => {
                const entry = getShiftEntry(selectedDate, shift);
                if (!entry.nurseIds.includes(nurseId))
                    entry.nurseIds.push(nurseId);
            }).then((ok) => { if (!ok)
                render(); });
            return;
        }
        case "shift-note": {
            const note = t.value;
            if (note === (findShiftEntry(selectedDate, shift)?.note ?? ""))
                return;
            void commitChange([`${shiftTitle(shift)}: ghi chú bàn giao`, note.trim() || "(xóa ghi chú)"], () => {
                getShiftEntry(selectedDate, shift).note = note;
            }).then((ok) => { if (!ok)
                render(); });
            return;
        }
        case "toggle-med": {
            const key = doneKey(t.dataset.id, selectedDate);
            if (t.checked)
                state.done[key] = true;
            else
                delete state.done[key];
            saveState();
            break;
        }
        case "rename-nurse": {
            const n = state.nurses.find((x) => x.id === t.dataset.id);
            const newName = t.value.trim();
            if (!n || !newName || newName === n.name) {
                renderNurseDialog();
                return;
            }
            void commitChange([`Đổi tên điều dưỡng: ${n.name} → ${newName}`], () => {
                n.name = newName;
            }).then(() => renderNurseDialog());
            return;
        }
        default: return;
    }
    render();
});
$("form-patient").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = {
        bed: String(f.get("bed")).trim(),
        name: String(f.get("name")).trim(),
        level: String(f.get("level")),
        nurseId: String(f.get("nurseId")),
    };
    const existing = state.patients.find((p) => p.id === editingPatientId);
    const heading = existing ? "Cập nhật bệnh nhân" : "Thêm bệnh nhân mới";
    const saved = await commitChange([heading, ...describePatient(data)], () => {
        if (existing)
            Object.assign(existing, data);
        else
            state.patients.push({ id: uid(), ...data });
    });
    if (saved)
        dlg("dlg-patient").close();
});
$("form-med").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = {
        patientId: String(f.get("patientId")),
        time: String(f.get("time")),
        drug: String(f.get("drug")).trim(),
        dose: String(f.get("dose")).trim(),
    };
    const existing = state.meds.find((m) => m.id === editingMedId);
    const patient = state.patients.find((p) => p.id === data.patientId);
    const saved = await commitChange([
        existing ? "Cập nhật cữ thuốc" : "Thêm cữ thuốc mới",
        `Bệnh nhân: ${patient ? `${patient.bed} - ${patient.name}` : ""}`,
        `Giờ: ${data.time}`,
        `Thuốc / y lệnh: ${data.drug}`,
        `Liều dùng: ${data.dose || "(không)"}`,
    ], () => {
        if (existing)
            Object.assign(existing, data);
        else
            state.meds.push({ id: uid(), ...data });
    });
    if (saved)
        dlg("dlg-med").close();
});
$("form-nurse").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = e.target.elements.namedItem("name");
    const name = input.value.trim();
    if (!name)
        return;
    const saved = await commitChange([`Thêm điều dưỡng mới: ${name}`], () => {
        state.nurses.push({ id: uid(), name });
    });
    if (saved) {
        input.value = "";
        renderNurseDialog();
    }
});
function readSettingsForm() {
    const f = $("form-settings");
    const val = (name) => f.elements.namedItem(name).value.trim();
    state.sheetUrl = val("url");
    state.scriptUrl = val("scriptUrl");
    state.scriptToken = val("scriptToken");
    saveState();
}
function describeError(err) {
    if (err instanceof TypeError) {
        return "Trình duyệt không tải được Sheet (mạng hoặc CORS). Kiểm tra link, và mở app qua 'npm start' thay vì mở file trực tiếp.";
    }
    return `Lỗi: ${err instanceof Error ? err.message : String(err)}`;
}
async function pushNow() {
    const status = $("settings-status");
    readSettingsForm();
    if (!state.scriptUrl || !state.scriptToken) {
        status.textContent = "Cần nhập URL Apps Script và mật khẩu để lưu lên Sheet.";
        return;
    }
    const confirmed = await askConfirm("Xác nhận lưu lên Google Sheet", [
        "Toàn bộ dữ liệu trong Sheet sẽ bị ghi đè bằng dữ liệu đang có trong app:",
        `${state.nurses.length} điều dưỡng`,
        `${state.patients.length} bệnh nhân`,
        `${state.meds.length} cữ thuốc`,
        `${state.shifts.filter((sh) => sh.nurseIds.length || sh.note.trim()).length} ca trực`,
    ], "Đồng ý lưu");
    if (!confirmed)
        return;
    status.textContent = "Đang lưu lên Sheet…";
    syncReady = true;
    await pushToSheet();
    status.textContent = $("sync-status").textContent ?? "";
}
$("form-settings").addEventListener("submit", async (e) => {
    e.preventDefault();
    readSettingsForm();
    const status = $("settings-status");
    status.textContent = "Đang tải…";
    try {
        status.textContent = await importFromSheet();
        render();
    }
    catch (err) {
        status.textContent = describeError(err);
    }
});
dlg("dlg-loading").addEventListener("cancel", (e) => e.preventDefault());
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d && d.id !== "dlg-loading")
    d.close(); }));
window.setInterval(() => {
    const active = document.activeElement;
    if (activeTab === "meds" && !(active instanceof HTMLTextAreaElement) && !(active instanceof HTMLInputElement && active.type !== "checkbox"))
        render();
}, 30000);
render();
if (state.scriptUrl && state.scriptToken) {
    setSyncStatus("☁ Đang tải từ Sheet…");
    importFromSheet()
        .then(() => render())
        .catch((err) => {
        setSyncStatus("⚠ Chưa đồng bộ");
        toast(describeError(err));
    });
}

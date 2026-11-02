// Site Notes — per-website episode/timestamp notes.
// Storage: chrome.storage.sync, one key per site: "site:<hostname>" -> [{id, title, episode, time, url, updated}]

const PREFIX = "site:";
const FIELDS = ["title", "episode", "time", "url"];
const $ = (id) => document.getElementById(id);

let currentHost = null;   // host of the active tab (null on chrome:// pages etc.)
let currentUrl = null;
let editing = null;       // { host, entries, entry } while the editor is open
let saveTimer = null;

function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function setStatus(text) {
  $("status").textContent = text;
  if (text) setTimeout(() => { if ($("status").textContent === text) $("status").textContent = ""; }, 1500);
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
}

// The url is prefilled on new entries, so it doesn't count as typed content.
const isEmpty = (e) => ["title", "episode", "time"].every((f) => !(e[f] || "").trim());

async function getSite(host) {
  const key = PREFIX + host;
  const data = await chrome.storage.sync.get(key);
  return data[key] || [];
}

async function putSite(host, entries) {
  const key = PREFIX + host;
  try {
    if (entries.length === 0) await chrome.storage.sync.remove(key);
    else await chrome.storage.sync.set({ [key]: entries });
    setStatus("Saved");
  } catch (e) {
    setStatus("Save failed: " + e.message);
  }
}

// ---------- List view ----------

async function showList() {
  $("editView").classList.add("hidden");
  $("listView").classList.remove("hidden");

  const all = await chrome.storage.sync.get(null);
  const list = $("list");
  list.innerHTML = "";

  // Current site first, then the rest alphabetically.
  const hosts = Object.keys(all)
    .filter((k) => k.startsWith(PREFIX))
    .map((k) => k.slice(PREFIX.length))
    .sort((a, b) => (a === currentHost ? -1 : b === currentHost ? 1 : a.localeCompare(b)));

  if (hosts.length === 0) {
    list.innerHTML = '<p class="muted empty">No notes yet. Press <b>+ Add</b> on a site you\'re watching.</p>';
    return;
  }

  for (const host of hosts) {
    const section = document.createElement("div");
    section.className = "group";
    const h = document.createElement("h4");
    h.textContent = host;
    if (host === currentHost) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "this site";
      h.appendChild(tag);
    }
    section.appendChild(h);

    const entries = [...all[PREFIX + host]].sort((a, b) => (b.updated || 0) - (a.updated || 0));
    for (const e of entries) {
      const item = document.createElement("div");
      item.className = "item";

      const main = document.createElement(e.url ? "a" : "div");
      main.className = "item-main";
      if (e.url) {
        main.href = e.url;
        main.title = "Open " + e.url;
        main.addEventListener("click", (ev) => {
          ev.preventDefault();
          chrome.tabs.create({ url: e.url });
        });
      }
      const name = document.createElement("div");
      name.className = "item-title";
      name.textContent = e.title || "Untitled";
      const meta = document.createElement("div");
      meta.className = "item-meta muted";
      meta.textContent = [e.episode, e.time].filter(Boolean).join(" · ") || formatDate(e.updated);
      main.append(name, meta);

      const edit = document.createElement("button");
      edit.className = "ghost icon";
      edit.title = "Edit";
      edit.textContent = "✎";
      edit.addEventListener("click", () => openEditor(host, e.id));

      item.append(main, edit);
      section.appendChild(item);
    }
    list.appendChild(section);
  }
}

// ---------- Editor view ----------

async function openEditor(host, id) {
  const entries = await getSite(host);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return showList();
  editing = { host, entries, entry };

  $("listView").classList.add("hidden");
  $("editView").classList.remove("hidden");
  $("editHost").textContent = host;
  for (const f of FIELDS) $("f-" + f).value = entry[f] || "";
  renderMeta();
  // Linking the current tab only makes sense if it's on the same site.
  $("relink").classList.toggle("hidden", host !== currentHost);
  $("f-title").focus();
}

function renderMeta() {
  const { entry } = editing;
  $("updated").textContent = entry.updated ? "Updated " + formatDate(entry.updated) : "";
}

function touch() {
  editing.entry.updated = Date.now();
  renderMeta();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  // Debounced saves keep the entry where it is; it only moves to another site
  // once editing is done (see relocate), so half-typed URLs don't file it wrongly.
  saveTimer = setTimeout(() => flush(false), 300);
}

// Entries are filed under the host of their url, so a url edited to another
// site has to move to that site's list to behave like a bookmark created there.
function normalizeUrl(url) {
  const s = (url || "").trim();
  if (!s) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : "https://" + s;
}

async function relocate() {
  const { host, entries, entry } = editing;
  entry.url = normalizeUrl(entry.url);
  $("f-url").value = entry.url;
  const newHost = hostOf(entry.url);
  if (!newHost || newHost === host || !entries.includes(entry)) return;

  await putSite(host, entries.filter((e) => e !== entry));
  const target = await getSite(newHost);
  target.unshift(entry);
  editing = { host: newHost, entries: target, entry };
  $("editHost").textContent = newHost;
  $("relink").classList.toggle("hidden", newHost !== currentHost);
}

async function flush(move = true) {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!editing) return;
  if (move) await relocate();
  await putSite(editing.host, editing.entries);
}

// Repair entries filed under a different site than their url points to
// (left behind by editing the url before entries moved with it).
async function migrate() {
  const all = await chrome.storage.sync.get(null);
  const moves = {};
  for (const key of Object.keys(all).filter((k) => k.startsWith(PREFIX))) {
    const host = key.slice(PREFIX.length);
    for (const e of all[key]) {
      const h = hostOf(normalizeUrl(e.url));
      if (h && h !== host) {
        if (!moves[host]) moves[host] = [];
        moves[host].push({ e, h });
      }
    }
  }
  for (const [host, list] of Object.entries(moves)) {
    const moved = new Set(list.map((m) => m.e.id));
    await putSite(host, (all[PREFIX + host]).filter((e) => !moved.has(e.id)));
    for (const { e, h } of list) {
      const target = await getSite(h);
      target.unshift({ ...e, url: normalizeUrl(e.url) });
      await putSite(h, target);
    }
  }
}

for (const f of FIELDS) {
  $("f-" + f).addEventListener("input", (ev) => {
    editing.entry[f] = ev.target.value;
    touch();
    scheduleSave();
  });
}
// Leaving the url field (or pressing Enter) finalises it and files it under its site.
$("f-url").addEventListener("change", () => flush());

$("relink").addEventListener("click", async () => {
  editing.entry.url = currentUrl;
  $("f-url").value = currentUrl || "";
  touch();
  await flush();
});

$("delete").addEventListener("click", async () => {
  const name = editing.entry.title || "this entry";
  if (!confirm(`Delete ${name}?`)) return;
  editing.entries = editing.entries.filter((e) => e.id !== editing.entry.id);
  await flush();
  editing = null;
  showList();
});

$("back").addEventListener("click", async () => {
  // A new entry left completely empty is discarded rather than saved.
  if (editing && isEmpty(editing.entry)) {
    editing.entries = editing.entries.filter((e) => e.id !== editing.entry.id);
  }
  await flush();
  editing = null;
  showList();
});

$("add").addEventListener("click", async () => {
  const entries = await getSite(currentHost);
  const entry = {
    id: crypto.randomUUID(),
    title: "", episode: "", time: "",
    url: currentUrl,
    updated: Date.now()
  };
  entries.unshift(entry);
  // Not saved until something is typed; Back discards it if left empty.
  editing = { host: currentHost, entries, entry };
  $("listView").classList.add("hidden");
  $("editView").classList.remove("hidden");
  $("editHost").textContent = currentHost;
  for (const f of FIELDS) $("f-" + f).value = entry[f] || "";
  renderMeta();
  $("relink").classList.remove("hidden");
  $("f-title").focus();
});

// Flush pending edits if the popup closes mid-typing (only non-empty entries).
window.addEventListener("blur", () => {
  if (editing && saveTimer && !isEmpty(editing.entry)) flush();
});

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || null;
  currentHost = currentUrl ? hostOf(currentUrl) : null;

  if (!currentHost) {
    $("add").disabled = true;
    $("addHint").classList.remove("hidden");
  }

  await migrate();

  // If this site is already bookmarked, jump straight to its editor: prefer the
  // entry with the same URL, otherwise the most recently updated one for the site.
  if (currentHost) {
    const entries = await getSite(currentHost);
    const sameUrl = (a, b) => !!a && !!b && a.split("#")[0] === b.split("#")[0];
    const match = entries.find((e) => sameUrl(e.url, currentUrl))
      || [...entries].sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
    if (match) return openEditor(currentHost, match.id);
  }
  showList();
})();

const LEGACY_STORAGE_KEY = "systeme-alters-app";
const ACCOUNTS_KEY = "systeme-alters-app:accounts";
const SESSION_KEY = "systeme-alters-app:session";
const DATA_PREFIX = "systeme-alters-app:data:";

let currentAccount = null;
let state = { alters: [], fronts: [], notes: [] };

const els = {
  authScreen: document.querySelector("#auth-screen"),
  appShell: document.querySelector("#app-shell"),
  authTabs: document.querySelectorAll(".auth-tab"),
  authViews: document.querySelectorAll(".auth-view"),
  authMessage: document.querySelector("#auth-message"),
  loginForm: document.querySelector("#login-panel"),
  loginUsername: document.querySelector("#login-username"),
  loginPassword: document.querySelector("#login-password"),
  registerForm: document.querySelector("#register-panel"),
  registerUsername: document.querySelector("#register-username"),
  registerPassword: document.querySelector("#register-password"),
  registerConfirm: document.querySelector("#register-confirm"),
  activeAccount: document.querySelector("#active-account"),
  logoutButton: document.querySelector("#logout-button"),
  tabs: document.querySelectorAll(".nav-tab"),
  views: document.querySelectorAll(".view"),
  alterForm: document.querySelector("#alter-form"),
  alterId: document.querySelector("#alter-id"),
  alterName: document.querySelector("#alter-name"),
  alterAge: document.querySelector("#alter-age"),
  alterRole: document.querySelector("#alter-role"),
  alterColor: document.querySelector("#alter-color"),
  alterNotes: document.querySelector("#alter-notes"),
  resetAlterForm: document.querySelector("#reset-alter-form"),
  alterList: document.querySelector("#alter-list"),
  frontForm: document.querySelector("#front-form"),
  frontAlter: document.querySelector("#front-alter"),
  frontTime: document.querySelector("#front-time"),
  frontPresence: document.querySelector("#front-presence"),
  frontContext: document.querySelector("#front-context"),
  frontList: document.querySelector("#front-list"),
  noteForm: document.querySelector("#note-form"),
  noteTitle: document.querySelector("#note-title"),
  noteMood: document.querySelector("#note-mood"),
  noteBody: document.querySelector("#note-body"),
  noteList: document.querySelector("#note-list"),
  currentFront: document.querySelector("#current-front"),
  currentFrontDetail: document.querySelector("#current-front-detail"),
  alterCount: document.querySelector("#alter-count"),
  lastNoteTitle: document.querySelector("#last-note-title"),
  lastNoteDate: document.querySelector("#last-note-date"),
  recentAlters: document.querySelector("#recent-alters"),
  recentTimeline: document.querySelector("#recent-timeline"),
  exportData: document.querySelector("#export-data"),
};

initialize();

function loadState() {
  const fallback = { alters: [], fronts: [], notes: [] };
  if (!currentAccount) return fallback;

  try {
    const stored = localStorage.getItem(getAccountDataKey(currentAccount.id));
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  if (!currentAccount) return;
  localStorage.setItem(getAccountDataKey(currentAccount.id), JSON.stringify(state));
}

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getAccountDataKey(accountId) {
  return `${DATA_PREFIX}${accountId}`;
}

function migrateLegacyDataIfNeeded() {
  if (!currentAccount) return;
  if (localStorage.getItem(getAccountDataKey(currentAccount.id))) return;

  const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyData) return;

  try {
    state = JSON.parse(legacyData);
    saveState();
  } catch {
    state = { alters: [], fronts: [], notes: [] };
  }
}

function initialize() {
  wireEvents();

  const sessionId = localStorage.getItem(SESSION_KEY);
  const account = getAccounts().find((item) => item.id === sessionId);

  if (account) {
    startSession(account);
  } else {
    showAuth();
  }
}

function seedIfEmpty() {
  if (state.alters.length || state.fronts.length || state.notes.length) return;

  const now = new Date();
  const hostId = makeId();
  const protectorId = makeId();

  state.alters.push(
    {
      id: hostId,
      name: "Exemple - Hôte",
      age: "adulte",
      role: "organisation du quotidien",
      color: "#3f7d68",
      notes: "Remplace ces exemples par les membres de ton système.",
      createdAt: now.toISOString(),
    },
    {
      id: protectorId,
      name: "Exemple - Protecteur",
      age: "",
      role: "sécurité et limites",
      color: "#9f4f39",
      notes: "Note ici les besoins, limites, préférences et déclencheurs utiles.",
      createdAt: now.toISOString(),
    }
  );

  state.fronts.push({
    id: makeId(),
    alterId: hostId,
    time: toDateTimeInputValue(now),
    presence: 3,
    context: "Premier front d'exemple.",
    createdAt: now.toISOString(),
  });

  state.notes.push({
    id: makeId(),
    title: "Bienvenue",
    mood: "stable",
    body: "Ce journal est local et modifiable. Il peut servir à garder une trace douce entre les membres du système.",
    createdAt: now.toISOString(),
  });

  saveState();
}

function wireEvents() {
  els.authTabs.forEach((tab) => {
    tab.addEventListener("click", () => setAuthView(tab.dataset.authView));
  });

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loginAccount();
  });

  els.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await registerAccount();
  });

  els.logoutButton.addEventListener("click", logoutAccount);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  els.alterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const alter = {
      id: els.alterId.value || makeId(),
      name: els.alterName.value.trim(),
      age: els.alterAge.value.trim(),
      role: els.alterRole.value.trim(),
      color: els.alterColor.value,
      notes: els.alterNotes.value.trim(),
      createdAt: new Date().toISOString(),
    };

    const existingIndex = state.alters.findIndex((item) => item.id === alter.id);
    if (existingIndex >= 0) {
      state.alters[existingIndex] = { ...state.alters[existingIndex], ...alter };
    } else {
      state.alters.unshift(alter);
    }

    saveState();
    resetAlterForm();
    render();
  });

  els.resetAlterForm.addEventListener("click", resetAlterForm);

  els.frontForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.fronts.unshift({
      id: makeId(),
      alterId: els.frontAlter.value,
      time: els.frontTime.value,
      presence: Number(els.frontPresence.value),
      context: els.frontContext.value.trim(),
      createdAt: new Date().toISOString(),
    });

    saveState();
    els.frontForm.reset();
    els.frontTime.value = toDateTimeInputValue(new Date());
    els.frontPresence.value = 3;
    render();
  });

  els.noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.notes.unshift({
      id: makeId(),
      title: els.noteTitle.value.trim(),
      mood: els.noteMood.value,
      body: els.noteBody.value.trim(),
      createdAt: new Date().toISOString(),
    });

    saveState();
    els.noteForm.reset();
    render();
  });

  els.exportData.addEventListener("click", exportJson);
}

function showAuth(message = "Les comptes restent dans ce navigateur. Ils ne sont pas synchronisés en ligne.") {
  els.authScreen.classList.remove("hidden");
  els.appShell.classList.add("hidden");
  els.authMessage.textContent = message;
}

function showApp() {
  els.authScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
}

function setAuthView(id) {
  els.authTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.authView === id));
  els.authViews.forEach((view) => view.classList.toggle("active", view.id === id));
  els.authMessage.textContent = "Les comptes restent dans ce navigateur. Ils ne sont pas synchronisés en ligne.";
}

async function registerAccount() {
  const username = normalizeUsername(els.registerUsername.value);
  const password = els.registerPassword.value;
  const confirm = els.registerConfirm.value;

  if (!username) {
    showAuthError("Choisis un nom de compte.");
    return;
  }

  if (password.length < 4) {
    showAuthError("Le mot de passe doit faire au moins 4 caractères.");
    return;
  }

  if (password !== confirm) {
    showAuthError("Les deux mots de passe ne correspondent pas.");
    return;
  }

  const accounts = getAccounts();
  if (accounts.some((account) => normalizeUsername(account.username) === username)) {
    showAuthError("Ce nom de compte existe déjà dans ce navigateur.");
    return;
  }

  const salt = makeId();
  const passwordAlgorithm = canUseStrongHash() ? "sha256" : "fallback";
  const account = {
    id: makeId(),
    username: username,
    salt,
    passwordAlgorithm,
    passwordHash: await hashPassword(password, salt, passwordAlgorithm),
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  saveAccounts(accounts);
  currentAccount = account;
  state = loadState();
  migrateLegacyDataIfNeeded();
  seedIfEmpty();
  localStorage.setItem(SESSION_KEY, account.id);
  clearAuthForms();
  showApp();
  render();
}

async function loginAccount() {
  const username = normalizeUsername(els.loginUsername.value);
  const password = els.loginPassword.value;
  const account = getAccounts().find((item) => normalizeUsername(item.username) === username);

  if (!account) {
    showAuthError("Compte introuvable dans ce navigateur.");
    return;
  }

  if ((account.passwordAlgorithm || "sha256") === "sha256" && !canUseStrongHash()) {
    showAuthError("Ce navigateur ne peut pas vérifier ce mot de passe. Ouvre l'app via GitHub Pages.");
    return;
  }

  const passwordHash = await hashPassword(password, account.salt, account.passwordAlgorithm || "sha256");
  if (passwordHash !== account.passwordHash) {
    showAuthError("Mot de passe incorrect.");
    return;
  }

  startSession(account);
  clearAuthForms();
}

function startSession(account) {
  currentAccount = account;
  state = loadState();
  seedIfEmpty();
  localStorage.setItem(SESSION_KEY, account.id);
  els.activeAccount.textContent = `Compte : ${account.username}`;
  showApp();
  render();
}

function logoutAccount() {
  localStorage.removeItem(SESSION_KEY);
  currentAccount = null;
  state = { alters: [], fronts: [], notes: [] };
  showAuth("Tu es déconnecté de ce compte local.");
}

function showAuthError(message) {
  els.authMessage.textContent = message;
}

function clearAuthForms() {
  els.loginForm.reset();
  els.registerForm.reset();
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function canUseStrongHash() {
  return Boolean(globalThis.crypto?.subtle && globalThis.TextEncoder);
}

async function hashPassword(password, salt, algorithm = "sha256") {
  const payload = `${salt}:${password}`;

  if (algorithm === "sha256" && canUseStrongHash()) {
    const bytes = new TextEncoder().encode(payload);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return fallbackHash(payload);
}

function fallbackHash(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fallback-${(hash >>> 0).toString(16)}`;
}

function setView(id) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === id));
  els.views.forEach((view) => view.classList.toggle("active", view.id === id));
}

function render() {
  els.frontTime.value ||= toDateTimeInputValue(new Date());
  renderAlterOptions();
  renderDashboard();
  renderAlters();
  renderFronts();
  renderNotes();
}

function renderAlterOptions() {
  els.frontAlter.innerHTML = state.alters
    .map((alter) => `<option value="${escapeAttr(alter.id)}">${escapeHtml(alter.name)}</option>`)
    .join("");
}

function renderDashboard() {
  const latestFront = sortedFronts()[0];
  const latestNote = state.notes[0];

  els.alterCount.textContent = state.alters.length;
  els.currentFront.textContent = latestFront ? getAlterName(latestFront.alterId) : "Non renseigné";
  els.currentFrontDetail.textContent = latestFront
    ? `${formatDate(latestFront.time)} · présence ${latestFront.presence}/5`
    : "Ajoute un front pour voir qui est présent.";

  els.lastNoteTitle.textContent = latestNote?.title || "Aucune";
  els.lastNoteDate.textContent = latestNote ? formatDate(latestNote.createdAt) : "Le journal est vide.";

  els.recentAlters.innerHTML = state.alters.length
    ? state.alters.slice(0, 5).map(renderCompactAlter).join("")
    : emptyState("Aucun alter enregistré.");

  els.recentTimeline.innerHTML = sortedFronts().length
    ? sortedFronts().slice(0, 5).map(renderTimelineItem).join("")
    : emptyState("Aucun front enregistré.");

  bindFrontDeleteButtons(els.recentTimeline);
}

function renderAlters() {
  els.alterList.innerHTML = state.alters.length
    ? state.alters.map(renderAlterCard).join("")
    : emptyState("Ajoute un premier alter pour commencer.");

  els.alterList.querySelectorAll("[data-edit-alter]").forEach((button) => {
    button.addEventListener("click", () => editAlter(button.dataset.editAlter));
  });

  els.alterList.querySelectorAll("[data-delete-alter]").forEach((button) => {
    button.addEventListener("click", () => deleteAlter(button.dataset.deleteAlter));
  });
}

function renderFronts() {
  els.frontList.innerHTML = sortedFronts().length
    ? sortedFronts().map(renderTimelineItem).join("")
    : emptyState("Aucun front enregistré.");

  bindFrontDeleteButtons(els.frontList);
}

function renderNotes() {
  els.noteList.innerHTML = state.notes.length
    ? state.notes.map(renderNoteCard).join("")
    : emptyState("Aucune note pour le moment.");
}

function renderAlterCard(alter) {
  return `
    <article class="alter-card">
      <header>
        <span class="swatch" style="background:${escapeAttr(alter.color)}"></span>
        <h3>${escapeHtml(alter.name)}</h3>
      </header>
      <div class="tag-row">
        ${alter.age ? `<span class="tag">${escapeHtml(alter.age)}</span>` : ""}
        ${alter.role ? `<span class="tag">${escapeHtml(alter.role)}</span>` : ""}
      </div>
      <p>${escapeHtml(alter.notes || "Aucune note.")}</p>
      <div class="card-actions">
        <button class="small-button" data-edit-alter="${escapeAttr(alter.id)}" type="button">Modifier</button>
        <button class="small-button" data-delete-alter="${escapeAttr(alter.id)}" type="button">Supprimer</button>
      </div>
    </article>
  `;
}

function renderCompactAlter(alter) {
  return `
    <div class="compact-item">
      <span class="swatch" style="background:${escapeAttr(alter.color)}"></span>
      <div>
        <strong>${escapeHtml(alter.name)}</strong>
        <p>${escapeHtml(alter.role || "Rôle non renseigné")}</p>
      </div>
    </div>
  `;
}

function renderTimelineItem(front) {
  const alter = state.alters.find((item) => item.id === front.alterId);
  const color = alter?.color || "#3f7d68";

  return `
    <article class="timeline-item" style="border-left-color:${escapeAttr(color)}">
      <strong>${escapeHtml(getAlterName(front.alterId))}</strong>
      <span>${formatDate(front.time)} · présence ${front.presence}/5</span>
      <p>${escapeHtml(front.context || "Pas de contexte ajouté.")}</p>
      <div class="timeline-actions">
        <button class="small-button danger-button" data-delete-front="${escapeAttr(front.id)}" type="button">Supprimer</button>
      </div>
    </article>
  `;
}

function renderNoteCard(note) {
  return `
    <article class="note-card">
      <h3>${escapeHtml(note.title)}</h3>
      <div class="tag-row">
        <span class="tag">${escapeHtml(note.mood)}</span>
        <span class="tag">${formatDate(note.createdAt)}</span>
      </div>
      <p>${escapeHtml(note.body)}</p>
    </article>
  `;
}

function editAlter(id) {
  const alter = state.alters.find((item) => item.id === id);
  if (!alter) return;

  els.alterId.value = alter.id;
  els.alterName.value = alter.name;
  els.alterAge.value = alter.age;
  els.alterRole.value = alter.role;
  els.alterColor.value = alter.color;
  els.alterNotes.value = alter.notes;
  els.alterName.focus();
}

function deleteAlter(id) {
  const alter = state.alters.find((item) => item.id === id);
  if (!alter) return;

  const confirmed = confirm(`Supprimer ${alter.name} ? Les fronts liés resteront dans l'historique.`);
  if (!confirmed) return;

  state.alters = state.alters.filter((item) => item.id !== id);
  saveState();
  render();
}

function bindFrontDeleteButtons(container) {
  container.querySelectorAll("[data-delete-front]").forEach((button) => {
    button.addEventListener("click", () => deleteFront(button.dataset.deleteFront));
  });
}

function deleteFront(id) {
  const front = state.fronts.find((item) => item.id === id);
  if (!front) return;

  const confirmed = confirm(`Supprimer ce front de ${getAlterName(front.alterId)} ?`);
  if (!confirmed) return;

  state.fronts = state.fronts.filter((item) => item.id !== id);
  saveState();
  render();
}

function resetAlterForm() {
  els.alterForm.reset();
  els.alterId.value = "";
  els.alterColor.value = "#3f7d68";
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `journal-systeme-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortedFronts() {
  return [...state.fronts].sort((a, b) => new Date(b.time) - new Date(a.time));
}

function getAlterName(id) {
  return state.alters.find((alter) => alter.id === id)?.name || "Alter supprimé";
}

function toDateTimeInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

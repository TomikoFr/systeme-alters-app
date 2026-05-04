const SUPABASE_URL = "https://qypuxsaycserysutqhty.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fjaREfJu0Y9rFjKkePYOkQ_rAZH3HPa";
const PHOTO_BUCKET = "alter-photos";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let currentUser = null;
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
  discordLinkButton: document.querySelector("#discord-link-button"),
  discordLinkRefresh: document.querySelector("#discord-link-refresh"),
  discordLinkStatus: document.querySelector("#discord-link-status"),
  discordLinkCode: document.querySelector("#discord-link-code"),
  logoutButton: document.querySelector("#logout-button"),
  tabs: document.querySelectorAll(".nav-tab"),
  views: document.querySelectorAll(".view"),
  alterForm: document.querySelector("#alter-form"),
  alterId: document.querySelector("#alter-id"),
  alterName: document.querySelector("#alter-name"),
  alterAge: document.querySelector("#alter-age"),
  alterRole: document.querySelector("#alter-role"),
  alterColor: document.querySelector("#alter-color"),
  alterPhoto: document.querySelector("#alter-photo"),
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

async function initialize() {
  wireEvents();

  const { data, error } = await db.auth.getSession();
  if (error) {
    showAuth(`Erreur de session : ${error.message}`);
    return;
  }

  if (data.session?.user) {
    await startSession(data.session.user);
  } else {
    showAuth();
  }
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
  els.discordLinkButton.addEventListener("click", generateDiscordLinkCode);
  els.discordLinkRefresh.addEventListener("click", loadDiscordLinkStatus);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  els.alterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveAlter();
  });

  els.resetAlterForm.addEventListener("click", resetAlterForm);

  els.frontForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveFront();
  });

  els.noteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveNote();
  });

  els.exportData.addEventListener("click", exportJson);
}

function showAuth(message = "Connecte-toi pour retrouver tes données depuis n'importe quel appareil.") {
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
  els.authMessage.textContent = "Les données seront liées à ton email via Supabase.";
}

async function registerAccount() {
  const email = normalizeEmail(els.registerUsername.value);
  const password = els.registerPassword.value;
  const confirm = els.registerConfirm.value;

  if (!email) {
    showAuthError("Entre une adresse email.");
    return;
  }

  if (password.length < 6) {
    showAuthError("Le mot de passe doit faire au moins 6 caractères.");
    return;
  }

  if (password !== confirm) {
    showAuthError("Les deux mots de passe ne correspondent pas.");
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
    },
  });
  if (error) {
    showAuthError(error.message);
    return;
  }

  clearAuthForms();

  if (data.session?.user) {
    await startSession(data.session.user);
  } else {
    setAuthView("login-panel");
    showAuth("Compte créé. Vérifie tes emails si Supabase demande une confirmation, puis connecte-toi.");
  }
}

async function loginAccount() {
  const email = normalizeEmail(els.loginUsername.value);
  const password = els.loginPassword.value;

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthError(error.message);
    return;
  }

  clearAuthForms();
  await startSession(data.user);
}

async function startSession(user) {
  currentUser = user;
  els.activeAccount.textContent = `Compte : ${user.email}`;
  showApp();
  await loadRemoteState();
  await loadDiscordLinkStatus();
  await seedIfEmpty();
  render();
}

async function logoutAccount() {
  await db.auth.signOut();
  currentUser = null;
  state = { alters: [], fronts: [], notes: [] };
  els.discordLinkCode.classList.add("hidden");
  els.discordLinkCode.textContent = "";
  els.discordLinkStatus.textContent = "Discord : non connecté";
  showAuth("Tu es déconnecté.");
}

function showAuthError(message) {
  els.authMessage.textContent = message;
}

function clearAuthForms() {
  els.loginForm.reset();
  els.registerForm.reset();
}

async function generateDiscordLinkCode() {
  if (!currentUser) return;

  els.discordLinkStatus.textContent = "Discord : code en attente";
  const code = makeLinkCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.from("discord_link_codes").delete().eq("user_id", currentUser.id);

  const { error } = await db.from("discord_link_codes").insert({
    code,
    expires_at: expiresAt,
  });

  if (error) {
    alert(`Erreur Supabase : ${error.message}. As-tu réexécuté supabase.sql ?`);
    return;
  }

  els.discordLinkCode.textContent = `Code Discord : ${code} · commande : /lier code:${code}`;
  els.discordLinkCode.classList.remove("hidden");
}

async function loadDiscordLinkStatus() {
  if (!currentUser) return;

  const { data, error } = await db
    .from("discord_links")
    .select("discord_user_id, created_at")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    els.discordLinkStatus.textContent = `Discord : erreur (${error.message})`;
    return;
  }

  if (!data) {
    els.discordLinkStatus.textContent = "Discord : non lié";
    return;
  }

  const shortId = data.discord_user_id.slice(-4);
  els.discordLinkStatus.textContent = `Discord : lié (…${shortId})`;
  els.discordLinkCode.classList.add("hidden");
  els.discordLinkCode.textContent = "";
}

async function loadRemoteState() {
  const [altersResult, frontsResult, notesResult] = await Promise.all([
    db.from("alters").select("*").order("created_at", { ascending: false }),
    db.from("fronts").select("*").order("time", { ascending: false }),
    db.from("notes").select("*").order("created_at", { ascending: false }),
  ]);

  const error = altersResult.error || frontsResult.error || notesResult.error;
  if (error) {
    showAuthError(`Erreur Supabase : ${error.message}. As-tu exécuté supabase.sql ?`);
    return;
  }

  state = {
    alters: await Promise.all(altersResult.data.map(mapAlterFromDb)),
    fronts: frontsResult.data.map(mapFrontFromDb),
    notes: notesResult.data.map(mapNoteFromDb),
  };
}

async function seedIfEmpty() {
  if (state.alters.length || state.fronts.length || state.notes.length) return;

  const now = new Date();

  const { data: alters, error: altersError } = await db
    .from("alters")
    .insert([
      {
        name: "Exemple - Hôte",
        age: "adulte",
        role: "organisation du quotidien",
        color: "#3f7d68",
        notes: "Remplace ces exemples par les membres de ton système.",
      },
      {
        name: "Exemple - Protecteur",
        age: "",
        role: "sécurité et limites",
        color: "#9f4f39",
        notes: "Note ici les besoins, limites, préférences et déclencheurs utiles.",
      },
    ])
    .select();

  if (altersError) {
    showAuthError(`Erreur Supabase : ${altersError.message}`);
    return;
  }

  await Promise.all([
    db.from("fronts").insert({
      alter_id: alters[0].id,
      time: now.toISOString(),
      presence: 3,
      context: "Premier front d'exemple.",
    }),
    db.from("notes").insert({
      title: "Bienvenue",
      mood: "stable",
      body: "Ce journal est synchronisé avec Supabase. Tu peux le retrouver après connexion.",
    }),
  ]);

  await loadRemoteState();
}

async function saveAlter() {
  const id = els.alterId.value || makeId();
  const existingAlter = state.alters.find((alter) => alter.id === id);
  const photoPath = await uploadAlterPhoto(id, existingAlter?.photoPath || "");

  const payload = {
    id,
    name: els.alterName.value.trim(),
    age: els.alterAge.value.trim(),
    role: els.alterRole.value.trim(),
    color: els.alterColor.value,
    notes: els.alterNotes.value.trim(),
    photo_path: photoPath,
  };

  const result = els.alterId.value
    ? await db.from("alters").update(payload).eq("id", id)
    : await db.from("alters").insert(payload);

  if (result.error) {
    alert(`Erreur Supabase : ${result.error.message}`);
    return;
  }

  resetAlterForm();
  await refreshAndRender();
}

async function saveFront() {
  if (!els.frontAlter.value) {
    alert("Ajoute d'abord un alter avant d'ajouter un front.");
    return;
  }

  const { error } = await db.from("fronts").insert({
    alter_id: els.frontAlter.value,
    time: new Date(els.frontTime.value).toISOString(),
    presence: Number(els.frontPresence.value),
    context: els.frontContext.value.trim(),
  });

  if (error) {
    alert(`Erreur Supabase : ${error.message}`);
    return;
  }

  els.frontForm.reset();
  els.frontTime.value = toDateTimeInputValue(new Date());
  els.frontPresence.value = 3;
  await refreshAndRender();
}

async function saveNote() {
  const { error } = await db.from("notes").insert({
    title: els.noteTitle.value.trim(),
    mood: els.noteMood.value,
    body: els.noteBody.value.trim(),
  });

  if (error) {
    alert(`Erreur Supabase : ${error.message}`);
    return;
  }

  els.noteForm.reset();
  await refreshAndRender();
}

async function refreshAndRender() {
  await loadRemoteState();
  render();
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
  els.frontAlter.innerHTML = state.alters.length
    ? state.alters.map((alter) => `<option value="${escapeAttr(alter.id)}">${escapeHtml(alter.name)}</option>`).join("")
    : '<option value="">Aucun alter disponible</option>';
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
        ${renderAlterPhoto(alter)}
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
      ${renderAlterPhoto(alter, "compact-photo")}
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
  els.alterPhoto.value = "";
  els.alterNotes.value = alter.notes;
  els.alterName.focus();
}

async function deleteAlter(id) {
  const alter = state.alters.find((item) => item.id === id);
  if (!alter) return;

  const confirmed = confirm(`Supprimer ${alter.name} ? Les fronts liés resteront dans l'historique.`);
  if (!confirmed) return;

  if (alter.photoPath) {
    await db.storage.from(PHOTO_BUCKET).remove([alter.photoPath]);
  }

  const { error } = await db.from("alters").delete().eq("id", id);
  if (error) {
    alert(`Erreur Supabase : ${error.message}`);
    return;
  }

  await refreshAndRender();
}

function bindFrontDeleteButtons(container) {
  container.querySelectorAll("[data-delete-front]").forEach((button) => {
    button.addEventListener("click", () => deleteFront(button.dataset.deleteFront));
  });
}

async function deleteFront(id) {
  const front = state.fronts.find((item) => item.id === id);
  if (!front) return;

  const confirmed = confirm(`Supprimer ce front de ${getAlterName(front.alterId)} ?`);
  if (!confirmed) return;

  const { error } = await db.from("fronts").delete().eq("id", id);
  if (error) {
    alert(`Erreur Supabase : ${error.message}`);
    return;
  }

  await refreshAndRender();
}

function resetAlterForm() {
  els.alterForm.reset();
  els.alterId.value = "";
  els.alterColor.value = "#3f7d68";
}

async function uploadAlterPhoto(alterId, previousPath) {
  const file = els.alterPhoto.files?.[0];
  if (!file) return previousPath;

  if (!file.type.startsWith("image/")) {
    alert("Choisis un fichier image.");
    return previousPath;
  }

  if (file.size > 4 * 1024 * 1024) {
    alert("La photo doit faire moins de 4 Mo.");
    return previousPath;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${currentUser.id}/${alterId}-${Date.now()}.${extension}`;
  const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    alert(`Erreur photo : ${error.message}`);
    return previousPath;
  }

  if (previousPath) {
    await db.storage.from(PHOTO_BUCKET).remove([previousPath]);
  }

  return path;
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

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

async function mapAlterFromDb(row) {
  const photoUrl = row.photo_path ? await getPhotoUrl(row.photo_path) : "";

  return {
    id: row.id,
    name: row.name,
    age: row.age || "",
    role: row.role || "",
    color: row.color || "#3f7d68",
    notes: row.notes || "",
    photoPath: row.photo_path || "",
    photoUrl,
    createdAt: row.created_at,
  };
}

async function getPhotoUrl(path) {
  const { data, error } = await db.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

function renderAlterPhoto(alter, className = "alter-photo") {
  if (alter.photoUrl) {
    return `<img class="${className}" src="${escapeAttr(alter.photoUrl)}" alt="">`;
  }

  return `<span class="swatch ${className}" style="background:${escapeAttr(alter.color)}"></span>`;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeLinkCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function mapFrontFromDb(row) {
  return {
    id: row.id,
    alterId: row.alter_id,
    time: row.time,
    presence: row.presence,
    context: row.context || "",
    createdAt: row.created_at,
  };
}

function mapNoteFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    mood: row.mood,
    body: row.body,
    createdAt: row.created_at,
  };
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

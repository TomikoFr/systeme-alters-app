const SUPABASE_URL = "https://qypuxsaycserysutqhty.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fjaREfJu0Y9rFjKkePYOkQ_rAZH3HPa";
const PHOTO_BUCKET = "alter-photos";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let currentUser = null;
let state = { alters: [], fronts: [], notes: [], proxySettings: null };

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
  mobileMenuToggle: document.querySelector("#mobile-menu-toggle"),
  mobileMenuPanel: document.querySelector("#mobile-menu-panel"),
  discordLinkButton: document.querySelector("#discord-link-button"),
  discordLinkRefresh: document.querySelector("#discord-link-refresh"),
  discordLinkStatus: document.querySelector("#discord-link-status"),
  discordLinkCode: document.querySelector("#discord-link-code"),
  autoproxyEnabled: document.querySelector("#autoproxy-enabled"),
  autoproxyAlter: document.querySelector("#autoproxy-alter"),
  autoproxySave: document.querySelector("#autoproxy-save"),
  autoproxyStatus: document.querySelector("#autoproxy-status"),
  logoutButton: document.querySelector("#logout-button"),
  tabs: document.querySelectorAll(".nav-tab"),
  views: document.querySelectorAll(".view"),
  alterForm: document.querySelector("#alter-form"),
  alterId: document.querySelector("#alter-id"),
  alterName: document.querySelector("#alter-name"),
  alterAge: document.querySelector("#alter-age"),
  alterPronouns: document.querySelector("#alter-pronouns"),
  alterRole: document.querySelector("#alter-role"),
  alterColor: document.querySelector("#alter-color"),
  alterPhoto: document.querySelector("#alter-photo"),
  alterNotes: document.querySelector("#alter-notes"),
  resetAlterForm: document.querySelector("#reset-alter-form"),
  alterList: document.querySelector("#alter-list"),
  spImportFile: document.querySelector("#sp-import-file"),
  spImportButton: document.querySelector("#sp-import-button"),
  spImportStatus: document.querySelector("#sp-import-status"),
  frontForm: document.querySelector("#front-form"),
  frontEntryList: document.querySelector("#front-entry-list"),
  frontTime: document.querySelector("#front-time"),
  frontContext: document.querySelector("#front-context"),
  frontList: document.querySelector("#front-list"),
  noteForm: document.querySelector("#note-form"),
  noteId: document.querySelector("#note-id"),
  noteTitle: document.querySelector("#note-title"),
  noteMood: document.querySelector("#note-mood"),
  noteBody: document.querySelector("#note-body"),
  resetNoteForm: document.querySelector("#reset-note-form"),
  noteList: document.querySelector("#note-list"),
  currentFront: document.querySelector("#current-front"),
  currentFrontDetail: document.querySelector("#current-front-detail"),
  alterCount: document.querySelector("#alter-count"),
  lastNoteTitle: document.querySelector("#last-note-title"),
  lastNoteDate: document.querySelector("#last-note-date"),
  recentAlters: document.querySelector("#recent-alters"),
  recentTimeline: document.querySelector("#recent-timeline"),
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

  els.mobileMenuToggle.addEventListener("click", toggleMobileMenu);

  els.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runBusy(els.loginForm.querySelector("[type=submit]"), "Connexion…", loginAccount);
  });

  els.registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runBusy(els.registerForm.querySelector("[type=submit]"), "Création…", registerAccount);
  });

  els.logoutButton.addEventListener("click", logoutAccount);
  els.discordLinkButton.addEventListener("click", () => {
    runBusy(els.discordLinkButton, "Génération…", generateDiscordLinkCode);
  });
  els.discordLinkRefresh.addEventListener("click", () => {
    runBusy(els.discordLinkRefresh, "Vérification…", loadDiscordLinkStatus);
  });
  els.autoproxySave.addEventListener("click", () => {
    runBusy(els.autoproxySave, "Enregistrement…", saveAutoproxySettings);
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setView(tab.dataset.view);
      closeMobileMenu();
    });
  });

  els.alterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runBusy(els.alterForm.querySelector("[type=submit]"), "Enregistrement…", saveAlter);
  });

  els.resetAlterForm.addEventListener("click", resetAlterForm);
  els.spImportButton.addEventListener("click", () => {
    runBusy(els.spImportButton, "Import…", importSimplyPlural);
  });

  els.frontForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runBusy(els.frontForm.querySelector("[type=submit]"), "Enregistrement…", saveFront);
  });

  els.noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runBusy(els.noteForm.querySelector("[type=submit]"), "Enregistrement…", saveNote);
  });

  els.resetNoteForm.addEventListener("click", resetNoteForm);

}

async function runBusy(button, busyText, fn) {
  if (!button) return fn();
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
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
  state = { alters: [], fronts: [], notes: [], proxySettings: null };
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
  const [altersResult, frontsResult, notesResult, proxyResult] = await Promise.all([
    db.from("alters").select("*").order("created_at", { ascending: false }),
    db.from("fronts").select("*, front_entries(*)").order("time", { ascending: false }),
    db.from("notes").select("*").order("created_at", { ascending: false }),
    db.from("discord_proxy_settings").select("*").maybeSingle(),
  ]);

  const proxyError = isMissingTableError(proxyResult.error) ? null : proxyResult.error;
  const error = altersResult.error || frontsResult.error || notesResult.error || proxyError;
  if (error) {
    showAuthError(`Erreur Supabase : ${error.message}. As-tu exécuté supabase.sql ?`);
    return;
  }

  state = {
    alters: await Promise.all(altersResult.data.map(mapAlterFromDb)),
    fronts: frontsResult.data.map(mapFrontFromDb),
    notes: notesResult.data.map(mapNoteFromDb),
    proxySettings: proxyResult.data && !proxyResult.error ? mapProxySettingsFromDb(proxyResult.data) : null,
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
        pronouns: "",
        role: "organisation du quotidien",
        color: "#3f7d68",
        notes: "Remplace ces exemples par les membres de ton système.",
      },
      {
        name: "Exemple - Protecteur",
        age: "",
        pronouns: "",
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

  const [{ data: latestFront, error: frontError }, noteResult] = await Promise.all([
    db.from("fronts").insert({
      time: now.toISOString(),
      context: "Premier front d'exemple.",
    }).select("id").single(),
    db.from("notes").insert({
      title: "Bienvenue",
      mood: "stable",
      body: "Ce journal est synchronisé avec Supabase. Tu peux le retrouver après connexion.",
    }),
  ]);

  if (frontError || noteResult.error) {
    showAuthError(`Erreur Supabase : ${(frontError || noteResult.error).message}`);
    return;
  }

  if (latestFront && alters[0]) {
    await db.from("front_entries").insert({
      front_id: latestFront.id,
      alter_id: alters[0].id,
      presence: 3,
    });
  }

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
    pronouns: els.alterPronouns.value.trim(),
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
  const entries = readSelectedFrontEntries();

  if (!entries.length) {
    alert("Sélectionne au moins un alter au front.");
    return;
  }

  const { data: front, error } = await db.from("fronts").insert({
    time: new Date(els.frontTime.value).toISOString(),
    context: els.frontContext.value.trim(),
  }).select("id").single();

  if (error) {
    alert(`Erreur Supabase : ${error.message}`);
    return;
  }

  const { error: entriesError } = await db.from("front_entries").insert(
    entries.map((entry) => ({
      front_id: front.id,
      alter_id: entry.alterId,
      presence: entry.presence,
    }))
  );

  if (entriesError) {
    alert(`Erreur Supabase : ${entriesError.message}`);
    return;
  }

  els.frontForm.reset();
  els.frontTime.value = toDateTimeInputValue(new Date());
  await refreshAndRender();
}

async function saveAutoproxySettings() {
  if (!currentUser) return;

  const alterId = els.autoproxyAlter.value;
  const enabled = els.autoproxyEnabled.checked;

  if (enabled && !alterId) {
    alert("Choisis un alter avant d'activer l'autoproxy.");
    return;
  }

  const { error } = await db.from("discord_proxy_settings").upsert(
    {
      user_id: currentUser.id,
      enabled,
      alter_id: alterId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    alert(`Erreur Supabase : ${error.message}. As-tu réexécuté supabase.sql ?`);
    return;
  }

  await refreshAndRender();
}

async function importSimplyPlural() {
  const file = els.spImportFile.files?.[0];
  if (!file) {
    els.spImportStatus.textContent = "Choisis d'abord un fichier JSON.";
    return;
  }

  try {
    els.spImportStatus.textContent = "Lecture de l'export...";
    const simplyPluralData = JSON.parse(await file.text());
    const members = findSimplyPluralMembers(simplyPluralData);
    const frontHistory = findSimplyPluralFrontHistory(simplyPluralData);

    if (!members.length && !frontHistory.length) {
      els.spImportStatus.textContent = "Aucun membre ou front Simply Plural reconnu dans ce fichier.";
      return;
    }

    const importedAlters = await importSimplyPluralMembers(members);
    const importedFronts = await importSimplyPluralFronts(frontHistory, importedAlters);

    await refreshAndRender();
    els.spImportStatus.textContent = `Import terminé : ${importedAlters.length} alter(s), ${importedFronts} front(s).`;
  } catch (error) {
    console.error(error);
    els.spImportStatus.textContent = `Import impossible : ${error.message}`;
  }
}

async function importSimplyPluralMembers(members) {
  const existingByName = new Map(state.alters.map((alter) => [normalizeName(alter.name), alter]));
  const rows = [];
  const imported = [];

  for (const member of members) {
    const name = readFirstString(member, ["name", "displayName", "nickname"]);
    if (!name) continue;

    const existing = existingByName.get(normalizeName(name));
    const color = normalizeColor(readFirstString(member, ["color", "colour", "colorHex"])) || existing?.color || "#3f7d68";
    const notes = readFirstString(member, ["desc", "description", "notes", "info"]) || existing?.notes || "";
    const role = readFirstString(member, ["role", "proxyName"]) || existing?.role || "";
    const pronouns = readFirstString(member, ["pronouns", "pronoms"]) || existing?.pronouns || "";
    const age = readFirstString(member, ["age", "birthday"]) || existing?.age || "";
    const id = existing?.id || makeId();

    rows.push({
      id,
      name,
      age,
      pronouns,
      role,
      color,
      notes,
      photo_path: existing?.photoPath || "",
    });

    imported.push({ id, name, sourceId: member.id || member.uuid || member.uid || member.memberId });
  }

  if (!rows.length) return [];

  const { error } = await db.from("alters").upsert(rows, { onConflict: "id" });
  if (error) throw error;

  return imported;
}

async function importSimplyPluralFronts(frontHistory, importedAlters) {
  if (!frontHistory.length) return 0;

  const alterBySourceId = new Map(importedAlters.filter((alter) => alter.sourceId).map((alter) => [String(alter.sourceId), alter]));
  const alterByName = new Map(importedAlters.map((alter) => [normalizeName(alter.name), alter]));
  const rows = [];

  for (const entry of frontHistory) {
    const alter = findFrontAlter(entry, alterBySourceId, alterByName);
    if (!alter) continue;

    const time = readDate(entry, ["time", "timestamp", "startTime", "start", "startedAt", "createdAt"]);
    if (!time) continue;

    rows.push({
      time: time.toISOString(),
      context: readFirstString(entry, ["comment", "note", "notes", "customStatus", "status"]) || "Import Simply Plural",
      entries: [{ alterId: alter.id, presence: 3 }],
    });
  }

  if (!rows.length) return 0;

  const { data: fronts, error } = await db.from("fronts").insert(
    rows.map((row) => ({ time: row.time, context: row.context }))
  ).select("id");
  if (error) throw error;

  const entryRows = rows.flatMap((row, index) =>
    row.entries.map((entry) => ({
      front_id: fronts[index].id,
      alter_id: entry.alterId,
      presence: entry.presence,
    }))
  );

  const { error: entriesError } = await db.from("front_entries").insert(entryRows);
  if (entriesError) throw entriesError;

  return rows.length;
}

async function saveNote() {
  const id = els.noteId.value;
  const payload = {
    title: els.noteTitle.value.trim(),
    mood: els.noteMood.value,
    body: els.noteBody.value.trim(),
  };

  const result = id
    ? await db.from("notes").update(payload).eq("id", id)
    : await db.from("notes").insert(payload);

  if (result.error) {
    alert(`Erreur Supabase : ${result.error.message}`);
    return;
  }

  resetNoteForm();
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

function toggleMobileMenu() {
  const isOpen = els.mobileMenuPanel.classList.toggle("open");
  els.mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
  els.mobileMenuToggle.textContent = isOpen ? "Fermer" : "Menu";
}

function closeMobileMenu() {
  els.mobileMenuPanel.classList.remove("open");
  els.mobileMenuToggle.setAttribute("aria-expanded", "false");
  els.mobileMenuToggle.textContent = "Menu";
}

function render() {
  els.frontTime.value ||= toDateTimeInputValue(new Date());
  renderAutoproxyOptions();
  renderFrontEntryOptions();
  renderDashboard();
  renderAlters();
  renderFronts();
  renderNotes();
}

function renderAutoproxyOptions() {
  const options = state.alters
    .map((alter) => `<option value="${escapeAttr(alter.id)}">${escapeHtml(alter.name)}</option>`)
    .join("");

  els.autoproxyAlter.innerHTML = options || '<option value="">Aucun alter disponible</option>';
  els.autoproxyEnabled.checked = Boolean(state.proxySettings?.enabled);
  els.autoproxyAlter.value = state.proxySettings?.alterId || state.alters[0]?.id || "";

  if (state.proxySettings?.enabled && state.proxySettings?.alterId) {
    els.autoproxyStatus.textContent = `Autoproxy : actif avec ${getAlterName(state.proxySettings.alterId)}`;
  } else {
    els.autoproxyStatus.textContent = "Autoproxy : désactivé";
  }
}

function renderFrontEntryOptions() {
  els.frontEntryList.innerHTML = state.alters.length
    ? state.alters.map(renderFrontEntryOption).join("")
    : emptyState("Ajoute d'abord un alter pour créer un front.");
}

function renderFrontEntryOption(alter) {
  const id = `front-entry-${alter.id}`;

  return `
    <div class="front-entry" data-front-entry="${escapeAttr(alter.id)}">
      <label for="${escapeAttr(id)}">
        <input id="${escapeAttr(id)}" type="checkbox" data-front-entry-check />
        <span class="swatch mini-swatch" style="background:${escapeAttr(alter.color)}"></span>
        <strong>${escapeHtml(alter.name)}</strong>
      </label>
      <label>
        Présence
        <input type="range" min="1" max="5" value="3" data-front-entry-presence />
      </label>
    </div>
  `;
}

function readSelectedFrontEntries() {
  return [...els.frontEntryList.querySelectorAll("[data-front-entry]")]
    .filter((entryElement) => entryElement.querySelector("[data-front-entry-check]")?.checked)
    .map((entryElement) => ({
      alterId: entryElement.dataset.frontEntry,
      presence: Number(entryElement.querySelector("[data-front-entry-presence]")?.value || 3),
    }));
}

function renderDashboard() {
  const fronts = sortedFronts();
  const latestFront = fronts[0];
  const latestNote = state.notes[0];

  els.alterCount.textContent = state.alters.length;
  els.currentFront.textContent = latestFront ? getFrontTitle(latestFront) : "Non renseigné";
  els.currentFrontDetail.textContent = latestFront
    ? `${formatDate(latestFront.time)} · ${latestFront.entries.length} alter(s)`
    : "Ajoute un front pour voir qui est présent.";

  els.lastNoteTitle.textContent = latestNote?.title || "Aucune";
  els.lastNoteDate.textContent = latestNote ? formatDate(latestNote.createdAt) : "Le journal est vide.";

  els.recentAlters.innerHTML = state.alters.length
    ? state.alters.slice(0, 5).map(renderCompactAlter).join("")
    : emptyState("Aucun alter enregistré.");

  els.recentTimeline.innerHTML = fronts.length
    ? fronts.slice(0, 5).map(renderTimelineItem).join("")
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
  const fronts = sortedFronts();
  els.frontList.innerHTML = fronts.length
    ? fronts.map(renderTimelineItem).join("")
    : emptyState("Aucun front enregistré.");

  bindFrontDeleteButtons(els.frontList);
}

function renderNotes() {
  els.noteList.innerHTML = state.notes.length
    ? state.notes.map(renderNoteCard).join("")
    : emptyState("Aucune note pour le moment.");

  els.noteList.querySelectorAll("[data-edit-note]").forEach((button) => {
    button.addEventListener("click", () => editNote(button.dataset.editNote));
  });

  els.noteList.querySelectorAll("[data-delete-note]").forEach((button) => {
    button.addEventListener("click", () => deleteNote(button.dataset.deleteNote));
  });
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
        ${alter.pronouns ? `<span class="tag">${escapeHtml(alter.pronouns)}</span>` : ""}
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
  const firstEntry = front.entries[0];
  const alter = state.alters.find((item) => item.id === firstEntry?.alterId);
  const color = alter?.color || "#3f7d68";

  return `
    <article class="timeline-item" style="border-left-color:${escapeAttr(color)}">
      <strong>${escapeHtml(getFrontTitle(front))}</strong>
      <span>${formatDate(front.time)}</span>
      <div class="tag-row">
        ${front.entries.map((entry) => `<span class="tag">${escapeHtml(getAlterName(entry.alterId))} · ${entry.presence}/5</span>`).join("")}
      </div>
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
      <div class="card-actions">
        <button class="small-button" data-edit-note="${escapeAttr(note.id)}" type="button">Modifier</button>
        <button class="small-button danger-button" data-delete-note="${escapeAttr(note.id)}" type="button">Supprimer</button>
      </div>
    </article>
  `;
}

function editAlter(id) {
  const alter = state.alters.find((item) => item.id === id);
  if (!alter) return;

  els.alterId.value = alter.id;
  els.alterName.value = alter.name;
  els.alterAge.value = alter.age;
  els.alterPronouns.value = alter.pronouns;
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

  const confirmed = confirm(`Supprimer ce front de ${getFrontTitle(front)} ?`);
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

function editNote(id) {
  const note = state.notes.find((item) => item.id === id);
  if (!note) return;

  els.noteId.value = note.id;
  els.noteTitle.value = note.title;
  els.noteMood.value = note.mood;
  els.noteBody.value = note.body;
  els.noteTitle.focus();
}

async function deleteNote(id) {
  const note = state.notes.find((item) => item.id === id);
  if (!note) return;

  const confirmed = confirm(`Supprimer la note "${note.title}" ?`);
  if (!confirmed) return;

  const { error } = await db.from("notes").delete().eq("id", id);
  if (error) {
    alert(`Erreur Supabase : ${error.message}`);
    return;
  }

  if (els.noteId.value === id) resetNoteForm();
  await refreshAndRender();
}

function resetNoteForm() {
  els.noteForm.reset();
  els.noteId.value = "";
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

function sortedFronts() {
  return [...state.fronts].sort((a, b) => new Date(b.time) - new Date(a.time));
}

function getAlterName(id) {
  return state.alters.find((alter) => alter.id === id)?.name || "Alter supprimé";
}

function getFrontTitle(front) {
  if (!front?.entries?.length) return "Front sans alter";

  return front.entries.map((entry) => getAlterName(entry.alterId)).join(", ");
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

function isMissingTableError(error) {
  if (!error) return false;
  const message = `${error.code || ""} ${error.message || ""}`.toLowerCase();
  return message.includes("discord_proxy_settings") && (message.includes("does not exist") || message.includes("pgrst"));
}

function findSimplyPluralMembers(data) {
  return findFirstArray(data, ["members", "memberships", "alters", "profiles"]);
}

function findSimplyPluralFrontHistory(data) {
  return findFirstArray(data, ["frontHistory", "front_history", "fronters", "fronts", "switches"]);
}

function findFirstArray(value, keys) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key];
  }

  for (const nested of Object.values(value)) {
    const found = findFirstArray(nested, keys);
    if (found.length) return found;
  }

  return [];
}

function findFrontAlter(entry, alterBySourceId, alterByName) {
  const sourceId = readFirstString(entry, ["member", "memberId", "member_id", "alter", "alterId", "profileId", "id"]);
  if (sourceId && alterBySourceId.has(String(sourceId))) return alterBySourceId.get(String(sourceId));

  const name = readFirstString(entry, ["name", "memberName", "alterName", "profileName"]);
  if (name && alterByName.has(normalizeName(name))) return alterByName.get(normalizeName(name));

  const nestedMember = entry.member || entry.alter || entry.profile;
  if (nestedMember && typeof nestedMember === "object") {
    const nestedId = readFirstString(nestedMember, ["id", "uuid", "uid", "memberId"]);
    if (nestedId && alterBySourceId.has(String(nestedId))) return alterBySourceId.get(String(nestedId));

    const nestedName = readFirstString(nestedMember, ["name", "displayName", "nickname"]);
    if (nestedName && alterByName.has(normalizeName(nestedName))) return alterByName.get(normalizeName(nestedName));
  }

  return null;
}

function readFirstString(object, keys) {
  if (!object || typeof object !== "object") return "";

  for (const key of keys) {
    const value = object[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
}

function readDate(object, keys) {
  const rawValue = readFirstString(object, keys);
  if (!rawValue) return null;

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeName(value) {
  return value.trim().toLowerCase();
}

function normalizeColor(value) {
  if (!value) return "";
  const color = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

async function mapAlterFromDb(row) {
  const photoUrl = row.photo_path ? await getPhotoUrl(row.photo_path) : "";

  return {
    id: row.id,
    name: row.name,
    age: row.age || "",
    pronouns: row.pronouns || "",
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
  const entries = (row.front_entries || []).map((entry) => ({
    id: entry.id,
    alterId: entry.alter_id,
    presence: entry.presence || 3,
    createdAt: entry.created_at,
  }));

  if (!entries.length && row.alter_id) {
    entries.push({
      id: `${row.id}-legacy`,
      alterId: row.alter_id,
      presence: row.presence || 3,
      createdAt: row.created_at,
    });
  }

  return {
    id: row.id,
    time: row.time,
    context: row.context || "",
    createdAt: row.created_at,
    entries,
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

function mapProxySettingsFromDb(row) {
  return {
    enabled: Boolean(row.enabled),
    alterId: row.alter_id || "",
    updatedAt: row.updated_at,
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

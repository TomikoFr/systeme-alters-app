const STORAGE_KEY = "plural-home:v1";
const SUPABASE_CONFIG = window.PLURAL_HOME_SUPABASE || {};
const SUPABASE_READY = Boolean(
  window.supabase &&
  SUPABASE_CONFIG.url &&
  SUPABASE_CONFIG.anonKey &&
  !SUPABASE_CONFIG.anonKey.includes("COLLE_ICI")
);
const supabaseClient = SUPABASE_READY
  ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null;
const DISCORD_PRESENCE_URL = "http://127.0.0.1:3020/presence";

const defaultData = {
  system: {
    name: "Mon système",
    note: ""
  },
  members: [
    {
      id: crypto.randomUUID(),
      name: "Alex",
      pronouns: "iel",
      color: "#276c72",
      group: "Avant",
      privacy: "privé",
      description: "Profil exemple à modifier."
    },
    {
      id: crypto.randomUUID(),
      name: "Mina",
      pronouns: "elle",
      color: "#b64d65",
      group: "Soutien",
      privacy: "proches",
      description: "Aime garder des notes courtes et claires."
    }
  ],
  activeFront: [],
  frontHistory: [],
  notes: []
};

let state = loadState();
let selectedFront = new Set(state.activeFront);
let currentUser = null;
let syncTimer = null;
let isLoadingRemote = false;
let linkedProviders = new Set();
let chatMessages = [];
let chatChannel = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const views = {
  dashboard: $("#view-dashboard"),
  members: $("#view-members"),
  front: $("#view-front"),
  journal: $("#view-journal"),
  chat: $("#view-chat"),
  settings: $("#view-settings")
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);

  try {
    return { ...structuredClone(defaultData), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSave();
}

function queueCloudSave() {
  if (!supabaseClient || !currentUser || isLoadingRemote) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    saveCloudState().catch((error) => {
      updateSyncHelp(`Synchro impossible : ${error.message}`);
    });
  }, 650);
}

async function saveCloudState() {
  if (!supabaseClient || !currentUser) return;

  const { error } = await supabaseClient
    .from("plural_profiles")
    .upsert({
      user_id: currentUser.id,
      data: state,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if (error) throw error;
  updateSyncHelp("Donnees synchronisees avec Supabase.");
}

async function loadCloudState() {
  if (!supabaseClient || !currentUser) return;
  isLoadingRemote = true;

  const { data, error } = await supabaseClient
    .from("plural_profiles")
    .select("data")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    isLoadingRemote = false;
    throw error;
  }

  if (data?.data) {
    state = { ...structuredClone(defaultData), ...data.data };
    selectedFront = new Set(state.activeFront || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    await saveCloudState();
  }

  isLoadingRemote = false;
  renderAll();
}

function currentDisplayName() {
  const frontName = currentFrontDisplayName();
  if (frontName) return frontName;

  return currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    currentUser?.user_metadata?.preferred_username ||
    currentUser?.email?.split("@")[0] ||
    "Membre";
}

function currentFrontDisplayName() {
  const names = (state.activeFront || [])
    .map(memberById)
    .filter(Boolean)
    .map((member) => member.name)
    .filter(Boolean);

  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}

function currentFrontPresence() {
  const members = (state.activeFront || []).map(memberById).filter(Boolean);
  return {
    systemName: state.system.name || "Plural Home",
    frontName: currentFrontDisplayName() || "Aucun front",
    frontCount: members.length,
    note: state.system.note || ""
  };
}

function syncDiscordPresence() {
  fetch(DISCORD_PRESENCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentFrontPresence()),
    keepalive: true
  }).catch(() => {
    // Discord Presence companion is optional and may be closed.
  });
}

function updateChatIdentity() {
  const node = $("#chat-identity");
  if (!node) return;
  node.textContent = `Envoi en tant que ${currentDisplayName()}`;
}

function updateChatStatus(message) {
  const node = $("#chat-status");
  if (node) node.textContent = message;
}

function renderChatMessages() {
  const container = $("#chat-messages");
  if (!container) return;

  updateChatIdentity();
  container.replaceChildren();

  if (!currentUser) {
    container.append(empty("Connecte-toi pour voir la discussion."));
    updateChatStatus("La discussion est disponible apres connexion.");
    return;
  }

  if (!chatMessages.length) {
    container.append(empty("Aucun message pour l'instant."));
    updateChatStatus("Tu peux lancer la discussion.");
    return;
  }

  chatMessages.forEach((message) => {
    const item = document.createElement("article");
    item.className = `chat-message${message.user_id === currentUser.id ? " mine" : ""}`;

    const head = document.createElement("div");
    head.className = "chat-message-head";

    const author = document.createElement("strong");
    author.textContent = message.display_name || "Membre";

    const date = document.createElement("span");
    date.textContent = formatDate(message.created_at);

    const body = document.createElement("p");
    body.textContent = message.body || "";

    head.append(author, date);
    item.append(head, body);
    container.append(item);
  });

  container.scrollTop = container.scrollHeight;
  updateChatStatus(`${chatMessages.length} message${chatMessages.length > 1 ? "s" : ""} charge${chatMessages.length > 1 ? "s" : ""}.`);
}

async function loadChatMessages() {
  if (!supabaseClient || !currentUser) {
    chatMessages = [];
    renderChatMessages();
    return;
  }

  updateChatStatus("Chargement de la discussion...");

  const { data, error } = await supabaseClient
    .from("global_chat_messages")
    .select("id,user_id,display_name,body,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    updateChatStatus(`Discussion impossible a charger : ${error.message}`);
    return;
  }

  chatMessages = (data || []).reverse();
  renderChatMessages();
}

async function sendChatMessage() {
  if (!supabaseClient || !currentUser) {
    updateChatStatus("Connecte-toi avant d'envoyer un message.");
    return;
  }

  const input = $("#chat-input");
  const button = $("#send-chat");
  const body = input.value.trim();
  if (!body) return;

  button.disabled = true;
  updateChatStatus("Envoi du message...");

  const { error } = await supabaseClient
    .from("global_chat_messages")
    .insert({
      user_id: currentUser.id,
      display_name: currentDisplayName(),
      body
    });

  button.disabled = false;

  if (error) {
    updateChatStatus(`Message impossible a envoyer : ${error.message}`);
    return;
  }

  input.value = "";
  updateChatStatus("Message envoye.");
  await loadChatMessages();
}

function stopChatSubscription() {
  if (!supabaseClient || !chatChannel) return;
  supabaseClient.removeChannel(chatChannel);
  chatChannel = null;
}

function subscribeChat() {
  if (!supabaseClient || !currentUser) return;

  stopChatSubscription();
  chatChannel = supabaseClient
    .channel("global-chat")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "global_chat_messages"
    }, (payload) => {
      if (!payload.new?.id || chatMessages.some((message) => message.id === payload.new.id)) return;
      chatMessages = [...chatMessages, payload.new].slice(-100);
      renderChatMessages();
    })
    .subscribe();
}

function updateAuthUi() {
  const isConfigured = Boolean(supabaseClient);
  $("#app-shell").hidden = !currentUser;
  $("#login-screen").hidden = Boolean(currentUser);
  $("#logout").hidden = !currentUser;
  $("#auth-status").textContent = currentUser ? "Connecte" : (isConfigured ? "Non connecte" : "Supabase a configurer");
  $("#auth-email").textContent = currentUser?.email || (isConfigured ? "Synchronisation locale" : "Cle publique manquante");
  $("#sync-label").textContent = currentUser ? "Synchronise" : "Mode local";
  $("#login-google-main").disabled = !isConfigured;
  $("#login-discord-main").disabled = !isConfigured;
  $("#login-email-button").disabled = !isConfigured;
  $("#signup-email-button").disabled = !isConfigured;
  $("#reset-password-button").disabled = !isConfigured;
  $("#login-message").textContent = currentUser
    ? "Connexion active."
    : isConfigured
      ? "Connecte-toi avec email, Google ou Discord."
      : "Supabase n'est pas encore configure.";
  updateSyncHelp(
    currentUser
      ? "Connecte a Supabase. Les changements sont sauvegardes en ligne."
      : isConfigured
        ? "Connecte-toi avec Google pour synchroniser les donnees."
        : "Ajoute la cle publique dans supabase-config.js pour activer Supabase."
  );
  renderLinkedIdentities();
}

function authRedirectUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  return url.toString();
}

async function signInWithProvider(provider) {
  if (!supabaseClient) {
    $("#login-message").textContent = "Supabase n'est pas encore configure.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectUrl()
    }
  });

  if (error) $("#login-message").textContent = `Connexion impossible : ${error.message}`;
}

function emailCredentials() {
  return {
    email: $("#login-email").value.trim(),
    password: $("#login-password").value
  };
}

async function signInWithEmailPassword() {
  if (!supabaseClient) {
    $("#login-message").textContent = "Supabase n'est pas encore configure.";
    return;
  }

  const { email, password } = emailCredentials();
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  $("#login-message").textContent = error
    ? `Connexion email impossible : ${error.message}`
    : "Connexion reussie.";
}

async function signUpWithEmailPassword() {
  if (!supabaseClient) {
    $("#login-message").textContent = "Supabase n'est pas encore configure.";
    return;
  }

  const { email, password } = emailCredentials();
  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authRedirectUrl()
    }
  });

  $("#login-message").textContent = error
    ? `Creation impossible : ${error.message}`
    : "Compte cree. Verifie tes emails si Supabase demande une confirmation.";
}

async function resetPasswordForEmail() {
  if (!supabaseClient) {
    $("#login-message").textContent = "Supabase n'est pas encore configure.";
    return;
  }

  const email = $("#login-email").value.trim();
  if (!email) {
    $("#login-message").textContent = "Entre ton email avant de demander un reset.";
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl()
  });

  $("#login-message").textContent = error
    ? `Reset impossible : ${error.message}`
    : "Email de reinitialisation envoye si le compte existe.";
}

function providerLabel(provider) {
  return {
    discord: "Discord",
    google: "Google"
  }[provider] || provider;
}

function renderLinkedIdentities() {
  const list = $("#identity-list");
  if (!list) return;

  list.replaceChildren();
  $("#link-google").disabled = !currentUser || linkedProviders.has("google");
  $("#link-discord").disabled = !currentUser || linkedProviders.has("discord");

  if (!currentUser) {
    $("#identity-help").textContent = "Connecte-toi pour voir les moyens lies a ton compte.";
    return;
  }

  if (!linkedProviders.size) {
    $("#identity-help").textContent = "Aucun moyen detecte pour l'instant.";
    return;
  }

  $("#identity-help").textContent = "Moyens deja lies a ce compte.";
  [...linkedProviders].sort().forEach((provider) => {
    const item = document.createElement("span");
    item.className = "identity-chip";
    item.textContent = providerLabel(provider);
    list.append(item);
  });
}

async function refreshLinkedIdentities() {
  linkedProviders = new Set();

  if (!supabaseClient || !currentUser) {
    renderLinkedIdentities();
    return;
  }

  const { data, error } = await supabaseClient.auth.getUserIdentities();
  if (error) {
    $("#identity-help").textContent = `Identites impossibles a charger : ${error.message}`;
    renderLinkedIdentities();
    return;
  }

  linkedProviders = new Set((data?.identities || []).map((identity) => identity.provider));
  renderLinkedIdentities();
}

async function linkProvider(provider) {
  if (!supabaseClient || !currentUser) {
    $("#identity-help").textContent = "Connecte-toi avant de lier un autre moyen.";
    return;
  }

  const { error } = await supabaseClient.auth.linkIdentity({
    provider,
    options: {
      redirectTo: authRedirectUrl()
    }
  });

  if (error) {
    $("#identity-help").textContent = `Liaison ${providerLabel(provider)} impossible : ${error.message}`;
  }
}

function updateSyncHelp(message) {
  const node = $("#sync-help");
  if (node) node.textContent = message;
}

async function initAuth() {
  if (!supabaseClient) {
    updateAuthUi();
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  currentUser = data.session?.user || null;
  updateAuthUi();

  if (currentUser) {
    await loadCloudState().catch((error) => {
      updateSyncHelp(`Chargement Supabase impossible : ${error.message}`);
    });
    await refreshLinkedIdentities();
    await loadChatMessages();
    subscribeChat();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    updateAuthUi();
    if (currentUser) {
      await loadCloudState().catch((error) => {
        updateSyncHelp(`Chargement Supabase impossible : ${error.message}`);
      });
      await refreshLinkedIdentities();
      await loadChatMessages();
      subscribeChat();
    } else {
      linkedProviders = new Set();
      chatMessages = [];
      stopChatSubscription();
      renderLinkedIdentities();
      renderChatMessages();
    }
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function memberById(id) {
  return state.members.find((member) => member.id === id);
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function softColor(hex) {
  const clean = hex.replace("#", "");
  const rgb = clean.match(/.{1,2}/g)?.map((value) => parseInt(value, 16)) || [39, 108, 114];
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.14)`;
}

function empty(text) {
  const node = $("#empty-template").content.firstElementChild.cloneNode(true);
  node.querySelector("p").textContent = text;
  return node;
}

function renderAll() {
  $("#system-name").value = state.system.name;
  $("#system-note").value = state.system.note;
  $("#today-title").textContent = state.system.name || "Vue d'ensemble";
  renderFrontSummary();
  renderDashboard();
  renderMembers();
  renderFrontPicker();
  renderJournal();
  renderChatMessages();
  saveState();
}

function renderFrontSummary() {
  const members = state.activeFront.map(memberById).filter(Boolean);
  const container = $("#front-now");
  container.replaceChildren();

  if (!members.length) {
    container.append(chip("Aucun front", "#9aa5a7"));
    return;
  }

  members.forEach((member) => container.append(chip(member.name, member.color)));
}

function chip(label, color) {
  const node = document.createElement("span");
  node.className = "chip";
  node.innerHTML = `<span class="dot"></span><span></span>`;
  node.querySelector(".dot").style.background = color;
  node.querySelector("span:last-child").textContent = label;
  return node;
}

function renderDashboard() {
  const current = $("#current-front");
  current.replaceChildren();
  const frontMembers = state.activeFront.map(memberById).filter(Boolean);

  if (!frontMembers.length) {
    current.append(empty("Aucun membre au front."));
  } else {
    frontMembers.forEach((member) => current.append(frontCard(member)));
  }

  const strip = $("#member-strip");
  strip.replaceChildren();
  state.members.slice(0, 6).forEach((member) => strip.append(memberCard(member, true)));
  if (!state.members.length) strip.append(empty("Aucun membre créé."));

  renderNotesInto($("#dashboard-notes"), state.notes.slice(0, 4));
  renderHistoryInto($("#recent-history"), state.frontHistory.slice(0, 5));
}

function frontCard(member) {
  const node = document.createElement("article");
  node.className = "front-card";
  node.style.setProperty("--member-color", member.color);
  node.style.setProperty("--member-soft", softColor(member.color));
  node.innerHTML = `
    <div class="avatar"></div>
    <div class="meta">
      <strong></strong>
      <span></span>
    </div>
  `;
  node.querySelector(".avatar").textContent = initials(member.name);
  node.querySelector("strong").textContent = member.name;
  node.querySelector("span").textContent = [member.pronouns, member.group].filter(Boolean).join(" · ") || member.privacy;
  return node;
}

function memberCard(member, compact = false) {
  const node = document.createElement("article");
  node.className = "member-card";
  node.innerHTML = `
    <div class="member-card-top">
      <div class="avatar"></div>
      <div class="meta">
        <h3></h3>
        <span></span>
      </div>
    </div>
    <p></p>
    <div class="member-actions">
      <button class="mini-button" type="button" data-front>Front</button>
      <button class="mini-button" type="button" data-edit>Modifier</button>
      <button class="mini-button" type="button" data-delete>Supprimer</button>
    </div>
  `;
  node.querySelector(".avatar").style.background = member.color;
  node.querySelector(".avatar").textContent = initials(member.name);
  node.querySelector("h3").textContent = member.name;
  node.querySelector("span").textContent = [member.pronouns, member.group, member.privacy].filter(Boolean).join(" · ");
  node.querySelector("p").textContent = compact ? (member.group || member.pronouns || "Membre") : (member.description || "Aucune description.");
  node.querySelector("[data-front]").addEventListener("click", () => {
    selectedFront = new Set([member.id]);
    commitFront(`Front rapide : ${member.name}`);
    switchView("front");
  });
  node.querySelector("[data-edit]").addEventListener("click", () => openMemberDialog(member.id));
  node.querySelector("[data-delete]").addEventListener("click", () => deleteMember(member.id));

  if (compact) {
    node.querySelector("[data-delete]").remove();
  }

  return node;
}

function renderMembers() {
  const groups = ["Tous", ...new Set(state.members.map((member) => member.group).filter(Boolean))];
  const groupFilter = $("#group-filter");
  const currentGroup = groupFilter.value || "Tous";
  groupFilter.replaceChildren(...groups.map((group) => new Option(group, group)));
  groupFilter.value = groups.includes(currentGroup) ? currentGroup : "Tous";

  const search = $("#member-search").value.trim().toLowerCase();
  const selectedGroup = groupFilter.value;
  const members = state.members.filter((member) => {
    const text = `${member.name} ${member.pronouns} ${member.group} ${member.description}`.toLowerCase();
    return text.includes(search) && (selectedGroup === "Tous" || member.group === selectedGroup);
  });

  const grid = $("#members-grid");
  grid.replaceChildren();
  members.forEach((member) => grid.append(memberCard(member)));
  if (!members.length) grid.append(empty("Aucun membre ne correspond."));
}

function renderFrontPicker() {
  const picker = $("#front-picker");
  picker.replaceChildren();
  state.members.forEach((member) => {
    const row = document.createElement("label");
    row.className = "front-option";
    row.innerHTML = `
      <input type="checkbox">
      <div class="avatar"></div>
      <div class="meta">
        <strong></strong>
        <span></span>
      </div>
    `;
    const input = row.querySelector("input");
    input.checked = selectedFront.has(member.id);
    input.addEventListener("change", () => {
      if (input.checked) selectedFront.add(member.id);
      else selectedFront.delete(member.id);
    });
    row.querySelector(".avatar").style.background = member.color;
    row.querySelector(".avatar").textContent = initials(member.name);
    row.querySelector("strong").textContent = member.name;
    row.querySelector("span").textContent = [member.pronouns, member.group].filter(Boolean).join(" · ");
    picker.append(row);
  });

  if (!state.members.length) picker.append(empty("Ajoute un membre pour suivre le front."));
  renderHistoryInto($("#front-history"), state.frontHistory);
}

function commitFront(defaultComment = "") {
  const ids = [...selectedFront];
  const comment = $("#front-comment").value.trim() || defaultComment;

  state.activeFront = ids;
  if (ids.length) {
    state.frontHistory.unshift({
      id: crypto.randomUUID(),
      memberIds: ids,
      comment,
      at: new Date().toISOString()
    });
  }

  $("#front-comment").value = "";
  renderAll();
  syncDiscordPresence();
}

function renderHistoryInto(container, items) {
  container.replaceChildren();
  if (!items.length) {
    container.append(empty("Aucun switch enregistré."));
    return;
  }

  items.forEach((item) => {
    const names = item.memberIds.map(memberById).filter(Boolean).map((member) => member.name).join(", ");
    const node = document.createElement("article");
    node.className = "history-item";
    node.innerHTML = `<strong></strong><span class="note-date"></span><p></p>`;
    node.querySelector("strong").textContent = names || "Membre supprimé";
    node.querySelector(".note-date").textContent = formatDate(item.at);
    node.querySelector("p").textContent = item.comment || "Switch";
    container.append(node);
  });
}

function renderJournal() {
  const authorFilter = $("#note-author-filter");
  const authors = ["Tous", ...state.members.map((member) => member.name)];
  const current = authorFilter.value || "Tous";
  authorFilter.replaceChildren(...authors.map((author) => new Option(author, author)));
  authorFilter.value = authors.includes(current) ? current : "Tous";

  const search = $("#note-search").value.trim().toLowerCase();
  const author = authorFilter.value;
  const notes = state.notes.filter((note) => {
    const member = memberById(note.authorId);
    const authorName = member?.name || "Inconnu";
    const text = `${note.title} ${note.body} ${authorName}`.toLowerCase();
    return text.includes(search) && (author === "Tous" || authorName === author);
  });

  renderNotesInto($("#journal-list"), notes);

  const noteAuthor = $("#note-author");
  noteAuthor.replaceChildren(
    new Option("Système", ""),
    ...state.members.map((member) => new Option(member.name, member.id))
  );
}

function renderNotesInto(container, notes) {
  container.replaceChildren();
  if (!notes.length) {
    container.append(empty("Aucune note."));
    return;
  }

  notes.forEach((note) => {
    const member = memberById(note.authorId);
    const node = document.createElement("article");
    node.className = "note-card";
    node.innerHTML = `
      <div class="panel-head">
        <div>
          <h3></h3>
          <span class="note-date"></span>
        </div>
        <button class="icon-button" type="button" title="Supprimer">×</button>
      </div>
      <p></p>
    `;
    node.querySelector("h3").textContent = note.title;
    node.querySelector(".note-date").textContent = `${member?.name || "Système"} · ${formatDate(note.at)}`;
    node.querySelector("p").textContent = note.body;
    node.querySelector("button").addEventListener("click", () => {
      state.notes = state.notes.filter((entry) => entry.id !== note.id);
      renderAll();
    });
    container.append(node);
  });
}

function openMemberDialog(id = "") {
  const member = id ? memberById(id) : null;
  $("#member-dialog-title").textContent = member ? "Modifier" : "Nouveau membre";
  $("#member-id").value = member?.id || "";
  $("#member-name").value = member?.name || "";
  $("#member-pronouns").value = member?.pronouns || "";
  $("#member-color").value = member?.color || "#4f8cff";
  $("#member-group").value = member?.group || "";
  $("#member-privacy").value = member?.privacy || "privé";
  $("#member-description").value = member?.description || "";
  $("#member-dialog").showModal();
}

function deleteMember(id) {
  const member = memberById(id);
  if (!member) return;
  if (!confirm(`Supprimer ${member.name} ?`)) return;

  state.members = state.members.filter((item) => item.id !== id);
  state.activeFront = state.activeFront.filter((item) => item !== id);
  selectedFront.delete(id);
  renderAll();
}

function switchView(name) {
  Object.entries(views).forEach(([key, view]) => view.classList.toggle("is-visible", key === name));
  $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === name));
}

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

$$("[data-open-member-form]").forEach((button) => {
  button.addEventListener("click", () => openMemberDialog());
});

$$("[data-open-note-form]").forEach((button) => {
  button.addEventListener("click", () => $("#note-dialog").showModal());
});

$("#quick-front").addEventListener("click", () => switchView("front"));
$("#save-front").addEventListener("click", () => commitFront());
$("#member-search").addEventListener("input", renderMembers);
$("#group-filter").addEventListener("change", renderMembers);
$("#note-search").addEventListener("input", renderJournal);
$("#note-author-filter").addEventListener("change", renderJournal);
$("#refresh-chat").addEventListener("click", loadChatMessages);

$("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendChatMessage();
});

$("#system-name").addEventListener("input", (event) => {
  state.system.name = event.target.value;
  renderFrontSummary();
  $("#today-title").textContent = state.system.name || "Vue d'ensemble";
  saveState();
});

$("#system-note").addEventListener("input", (event) => {
  state.system.note = event.target.value;
  saveState();
});

$("#member-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();

  const id = $("#member-id").value || crypto.randomUUID();
  const member = {
    id,
    name: $("#member-name").value.trim(),
    pronouns: $("#member-pronouns").value.trim(),
    color: $("#member-color").value,
    group: $("#member-group").value.trim(),
    privacy: $("#member-privacy").value,
    description: $("#member-description").value.trim()
  };

  const index = state.members.findIndex((item) => item.id === id);
  if (index >= 0) state.members[index] = member;
  else state.members.push(member);

  $("#member-dialog").close();
  renderAll();
});

$("#note-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();

  state.notes.unshift({
    id: crypto.randomUUID(),
    title: $("#note-title").value.trim(),
    authorId: $("#note-author").value,
    body: $("#note-body").value.trim(),
    at: new Date().toISOString()
  });

  $("#note-title").value = "";
  $("#note-body").value = "";
  $("#note-dialog").close();
  renderAll();
});

$("#export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plural-home-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$("#import-data").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    state = { ...structuredClone(defaultData), ...imported };
    selectedFront = new Set(state.activeFront || []);
    renderAll();
  } catch {
    alert("Import impossible : JSON invalide.");
  } finally {
    event.target.value = "";
  }
});

$("#reset-data").addEventListener("click", () => {
  if (!confirm("Effacer toutes les données locales de Plural Home ?")) return;
  state = structuredClone(defaultData);
  selectedFront = new Set(state.activeFront);
  renderAll();
});

$("#login-google-main").addEventListener("click", async () => {
  await signInWithProvider("google");
});

$("#login-discord-main").addEventListener("click", async () => {
  await signInWithProvider("discord");
});

$("#email-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await signInWithEmailPassword();
});

$("#signup-email-button").addEventListener("click", async () => {
  await signUpWithEmailPassword();
});

$("#reset-password-button").addEventListener("click", async () => {
  await resetPasswordForEmail();
});

$("#logout").addEventListener("click", async () => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) updateSyncHelp(`Deconnexion impossible : ${error.message}`);
});

$("#sync-now").addEventListener("click", async () => {
  if (!supabaseClient || !currentUser) {
    updateAuthUi();
    return;
  }

  await saveCloudState().catch((error) => {
    updateSyncHelp(`Synchro impossible : ${error.message}`);
  });
});

$("#link-google").addEventListener("click", async () => {
  await linkProvider("google");
});

$("#link-discord").addEventListener("click", async () => {
  await linkProvider("discord");
});

renderAll();
initAuth();
syncDiscordPresence();

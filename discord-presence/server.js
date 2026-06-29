require("dotenv").config();

const express = require("express");
const cors = require("cors");
const DiscordRPC = require("discord-rpc");

const clientId = process.env.DISCORD_CLIENT_ID;
const port = Number(process.env.PORT || 3020);
const largeImageKey = process.env.LARGE_IMAGE_KEY || "plural_home";

if (!clientId || clientId === "ton_client_id_discord") {
  console.error("DISCORD_CLIENT_ID manquant. Copie .env.example vers .env et ajoute ton Client ID Discord.");
  process.exit(1);
}

DiscordRPC.register(clientId);

const app = express();
const rpc = new DiscordRPC.Client({ transport: "ipc" });
const startedAt = Date.now();

let rpcReady = false;
let lastPresence = {
  systemName: "Plural Home",
  frontName: "Aucun front",
  frontCount: 0,
  note: ""
};

app.use(cors({ origin: true }));
app.use(express.json({ limit: "16kb" }));

function cleanText(value, fallback) {
  const text = String(value || "").trim();
  return (text || fallback).slice(0, 120);
}

function buildActivity(presence) {
  const systemName = cleanText(presence.systemName, "Plural Home");
  const frontName = cleanText(presence.frontName, "Aucun front");
  const count = Number(presence.frontCount || 0);

  return {
    details: count > 0 ? `Au front : ${frontName}` : "Aucun front actif",
    state: systemName,
    startTimestamp: startedAt,
    largeImageKey,
    largeImageText: "Plural Home",
    instance: false
  };
}

async function updateActivity() {
  if (!rpcReady) return;
  await rpc.setActivity(buildActivity(lastPresence));
}

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    discordConnected: rpcReady,
    presence: lastPresence
  });
});

app.post("/presence", async (request, response) => {
  lastPresence = {
    systemName: cleanText(request.body.systemName, "Plural Home"),
    frontName: cleanText(request.body.frontName, "Aucun front"),
    frontCount: Number(request.body.frontCount || 0),
    note: cleanText(request.body.note, "")
  };

  try {
    await updateActivity();
    response.json({ ok: true, discordConnected: rpcReady });
  } catch (error) {
    response.status(500).json({ ok: false, error: error.message });
  }
});

rpc.on("ready", async () => {
  rpcReady = true;
  console.log("Discord RPC connecte.");
  await updateActivity();
});

rpc.on("disconnected", () => {
  rpcReady = false;
  console.log("Discord RPC deconnecte.");
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Compagnon Rich Presence sur http://127.0.0.1:${port}`);
});

rpc.login({ clientId }).catch((error) => {
  console.error("Connexion Discord RPC impossible. Ouvre Discord Desktop puis relance.");
  console.error(error.message);
});

# Plural Home

## Lancer le site avec Docker

```powershell
docker compose up --build
```

Le site sera disponible sur :

```text
http://localhost:5177/
```

Pour l'arreter :

```powershell
docker compose down
```

## Discord Rich Presence

Le dossier `discord-presence` contient un compagnon local qui affiche le front actuel dans ton statut Discord.

Prerequis :

- Discord Desktop ouvert sur le PC.
- Une application Discord creee sur <https://discord.com/developers/applications>.
- Le Client ID de cette application.

Configuration :

```powershell
cd E:\Projet\plural-home\discord-presence
Copy-Item .env.example .env
```

Ouvre `.env`, puis remplace :

```text
DISCORD_CLIENT_ID=ton_client_id_discord
```

Installation et lancement :

```powershell
pnpm install
pnpm start
```

Quand `Plural Home` change de front, le site envoie l'etat au compagnon local sur :

```text
http://127.0.0.1:3020/presence
```

Verification :

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3020/health
```

Dans le portail Discord, tu peux ajouter une image nommee `plural_home` dans les assets Rich Presence de ton application. Si tu utilises un autre nom, change `LARGE_IMAGE_KEY` dans `.env`.

Note : le compagnon Discord est a lancer directement sur Windows, pas dans Docker, car Rich Presence doit communiquer avec Discord Desktop via l'IPC local.

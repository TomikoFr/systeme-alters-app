# Journal du systeme

App web en francais pour suivre les alters d'un systeme TDI, les fronts/co-fronts et un journal partage.

## Lancer l'app

Ouvre `index.html` dans ton navigateur, ou utilise la version GitHub Pages.

## Configuration Supabase

Avant d'utiliser l'app en ligne, execute le fichier `supabase.sql` dans Supabase :

1. Ouvre ton projet Supabase.
2. Va dans `SQL Editor`.
3. Colle le contenu de `supabase.sql`.
4. Clique sur `Run`.

Le script cree les tables `alters`, `fronts` et `notes`, active Row Level Security, puis ajoute les regles pour que chaque compte voie uniquement ses propres donnees.

Dans Supabase, verifie aussi `Authentication` > `URL Configuration` :

- `Site URL` : l'URL GitHub Pages de l'app.
- `Redirect URLs` : ajoute aussi cette meme URL.

## Fonctions

- Connexion et creation de compte avec Supabase Auth.
- Donnees synchronisees entre appareils apres connexion.
- Tableau de bord avec front actuel, nombre d'alters et derniere note.
- Repertoire des alters avec nom, age, role, couleur, photo et notes.
- Suivi des fronts avec date, intensite de presence et contexte.
- Journal partage avec humeur et notes.
- Export JSON pour faire une sauvegarde.

## Securite

La cle Supabase utilisee dans `app.js` est une cle publishable, prevue pour etre visible dans le navigateur. Les donnees et les photos restent protegees par les policies RLS dans `supabase.sql`.

Ne publie jamais la cle `secret` ou `service_role`.

## Note importante

Cette app est un outil personnel d'organisation. Elle ne remplace pas un suivi medical ou therapeutique.

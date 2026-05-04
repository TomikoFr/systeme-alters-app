# Journal du système

Petite app locale en français pour suivre les alters d'un système TDI, les fronts/co-fronts et un journal partagé.

## Lancer l'app

Ouvre `index.html` dans ton navigateur.

Les données sont stockées dans le `localStorage` du navigateur. Elles restent donc sur cet ordinateur et dans ce profil de navigateur, sauf si tu utilises le bouton d'export.

## Fonctions

- Comptes locaux avec page de connexion.
- Tableau de bord avec front actuel, nombre d'alters et dernière note.
- Répertoire des alters avec nom, âge, rôle, couleur et notes.
- Suivi des fronts avec date, intensité de présence et contexte.
- Journal partagé avec humeur et notes.
- Export JSON pour faire une sauvegarde.

## Comptes

Les comptes sont stockés dans le navigateur avec `localStorage`. Ils servent à séparer plusieurs espaces de données sur le même appareil ou navigateur.

Sur GitHub Pages, il n'y a pas de serveur ni de base de données distante : un compte créé sur un navigateur ne sera pas automatiquement disponible sur un autre ordinateur ou téléphone.

Les mots de passe sont hachés côté navigateur quand l'API crypto est disponible. Ce système protège surtout contre les accès accidentels sur le même navigateur ; il ne remplace pas une vraie authentification serveur.

## Note importante

Cette app est un outil personnel d'organisation. Elle ne remplace pas un suivi médical ou thérapeutique.

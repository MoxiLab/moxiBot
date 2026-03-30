# Qu'est-ce que la commande starboard ?

La commande `starboard` vous permet de mettre en avant les meilleurs messages de votre serveur dans un canal spécial. Lorsqu'un message reçoit suffisamment de réactions (par exemple, ⭐), le bot le publie automatiquement dans le canal starboard pour que toute la communauté puisse le voir.

## Comment l'utiliser ?

1. **Configurez le canal starboard :**
   - Utilisez la commande `/starboard set <canal>` pour choisir où apparaîtront les messages mis en avant.

2. **Définissez le nombre de réactions nécessaires :**
   - Vous pouvez définir combien de réactions (par exemple, des étoiles) un message doit recevoir pour être mis en avant. Exemple : `/starboard threshold 3` ne mettra en avant que les messages ayant 3 étoiles ou plus.

3. **Désactivez ou ajustez le système :**
   - Pour désactiver le starboard, utilisez `/starboard disable`.
   - Vous pouvez changer le canal ou le seuil à tout moment avec les mêmes commandes.

## Exemple d'utilisation

- `/starboard set #vedettes` → Définit #vedettes comme canal starboard.
- `/starboard threshold 5` → Seuls les messages avec 5 étoiles ou plus seront mis en avant.
- `/starboard disable` → Désactive le système starboard.

## Remarques
- Seuls les administrateurs peuvent configurer le starboard.
- Le bot doit avoir la permission de voir et d'envoyer des messages dans le canal starboard.
- Les messages supprimés ou modifiés peuvent ne plus apparaître dans le starboard.

Ainsi, vous pouvez encourager votre communauté à partager du contenu de qualité et à reconnaître les meilleures contributions !

# Cos'è il comando starboard?

Il comando `starboard` ti permette di mettere in evidenza i migliori messaggi del tuo server in un canale speciale. Quando un messaggio riceve abbastanza reazioni (ad esempio, ⭐), il bot lo pubblica automaticamente nel canale starboard per tutta la community.

## Come si usa?

1. **Configura il canale starboard:**
   - Usa il comando `/starboard set <canale>` per scegliere dove appariranno i messaggi in evidenza.

2. **Definisci il numero di reazioni necessarie:**
   - Puoi impostare quante reazioni (ad esempio, stelle) servono per mettere in evidenza un messaggio. Esempio: `/starboard threshold 3` metterà in evidenza solo i messaggi con 3 o più stelle.

3. **Disattiva o regola il sistema:**
   - Per disattivare lo starboard, usa `/starboard disable`.
   - Puoi cambiare canale o soglia in qualsiasi momento con gli stessi comandi.

## Esempio d'uso

- `/starboard set #in_evidenza` → Imposta #in_evidenza come canale starboard.
- `/starboard threshold 5` → Solo i messaggi con 5 o più stelle saranno messi in evidenza.
- `/starboard disable` → Disattiva il sistema starboard.

## Note
- Solo gli amministratori possono configurare lo starboard.
- Il bot deve avere il permesso di vedere e inviare messaggi nel canale starboard.
- I messaggi eliminati o modificati potrebbero non apparire più nello starboard.

Così puoi motivare la tua community a condividere contenuti di qualità e riconoscere i migliori contributi!

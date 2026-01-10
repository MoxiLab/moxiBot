# Was ist der Starboard-Befehl?

Mit dem Befehl `starboard` kannst du die besten Nachrichten deines Servers in einem speziellen Kanal hervorheben. Wenn eine Nachricht genügend Reaktionen (z. B. ⭐) erhält, postet der Bot sie automatisch im Starboard-Kanal, damit sie jeder sehen kann.

## Wie benutzt man ihn?

1. **Starboard-Kanal einrichten:**
   - Verwende den Befehl `/starboard set <Kanal>`, um den Kanal für hervorgehobene Nachrichten festzulegen.

2. **Anzahl der benötigten Reaktionen festlegen:**
   - Du kannst festlegen, wie viele Reaktionen (z. B. Sterne) eine Nachricht benötigt, um hervorgehoben zu werden. Beispiel: `/starboard threshold 3` hebt nur Nachrichten mit 3 oder mehr Sternen hervor.

3. **System deaktivieren oder anpassen:**
   - Um das Starboard zu deaktivieren, verwende `/starboard disable`.
   - Du kannst den Kanal oder die Schwelle jederzeit mit denselben Befehlen ändern.

## Beispiel für die Nutzung

- `/starboard set #highlights` → Setzt #highlights als Starboard-Kanal.
- `/starboard threshold 5` → Nur Nachrichten mit 5 oder mehr Sternen werden hervorgehoben.
- `/starboard disable` → Deaktiviert das Starboard-System.

## Hinweise
- Nur Administratoren können das Starboard konfigurieren.
- Der Bot benötigt die Berechtigung, Nachrichten im Starboard-Kanal zu sehen und zu senden.
- Gelöschte oder bearbeitete Nachrichten werden möglicherweise nicht mehr im Starboard angezeigt.

So kannst du deine Community motivieren, hochwertige Inhalte zu teilen und die besten Beiträge zu würdigen!

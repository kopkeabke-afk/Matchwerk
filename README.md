# funke 🔥 – Dating-App (iOS · Android · Web)

Eine vollständige Dating-App auf Basis von **Expo SDK 58 / React Native**, mit **Supabase** als Backend
(Auth, Postgres, Realtime-Chat, Storage, Push) – und einem **Offline-Demo-Modus**, der ohne Server sofort läuft.

## Was funke besser macht als Tinder, Hinge & Bumble

| Feature | Tinder | Hinge | Bumble | **funke** |
|---|---|---|---|---|
| Swipen mit Gesten, Undo, Super-Like | ✅ | – | ✅ | ✅ (Undo kostenlos) |
| Like auf ein Foto/eine Antwort + Kommentar | – | ✅ | – | ✅ |
| Wer schreibt zuerst? | – | – | nur Frauen | **jede:r wählt selbst** |
| Match läuft ab, 1× verlängerbar | – | – | ✅ | ✅ (48 h + 24 h) |
| Sehen, wer dich geliked hat | 💰 | 💰 | 💰 | **kostenlos** |
| Transparenter Match-Score mit Begründung | – | – | – | ✅ |
| Daily Spark (bestes Match des Tages zuerst) | – | ✅ (Most Compatible) | – | ✅ |
| Persönliche Icebreaker aus Gemeinsamkeiten | – | – | ✅ | ✅ |
| Absichten als Dealbreaker-Filter | – | ✅ | ✅ | ✅ |
| Kein Werbe-Tracking | – | – | – | ✅ |

Dazu: E-Mail-Login per Code (kein Passwort), 8-stufiges Onboarding mit 18+-Prüfung, Profil-Vollständigkeit mit Tipps,
Profil pausieren, Melden & Blockieren überall, Sicherheits-Center, In-App-Kontolöschung, Dark Mode, Haptik.

## Schnellstart (Demo-Modus, ohne Server)

```bash
npm install
npx expo start
```
Im Browser `w` drücken oder mit einem Dev-Build auf dem Handy öffnen. Beliebige E-Mail + beliebigen Code eingeben.
Der Demo-Modus enthält 28 Beispielprofile in Berlin, simulierte Likes, Matches und Antworten im Chat.

## Produktion einrichten

### 1. Supabase
1. Projekt auf <https://supabase.com> anlegen (Region **EU / Frankfurt** für DSGVO).
2. Beide Dateien aus `supabase/migrations/` der Reihe nach im SQL-Editor ausführen (oder `supabase db push`).
3. Auth → Providers → **Email** aktivieren, Template „Magic Link“ so anpassen, dass es `{{ .Token }}` (6-stelliger Code) enthält.
4. Auth → SMTP: eigenen Mail-Provider eintragen (Supabase-Standard ist stark limitiert).
5. `.env` anlegen (siehe `.env.example`) mit `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### 2. Push-Benachrichtigungen
```bash
supabase functions deploy push --no-verify-jwt
supabase secrets set WEBHOOK_SECRET=<zufälliger-string>
```
Dann unter Database → Webhooks zwei Webhooks (INSERT auf `messages` und `matches`) auf die Function zeigen lassen,
mit Header `x-webhook-secret`.

### 3. Moderation
- Meldungen landen in `reports`. Die Ansicht **`moderation_queue`** (nur im Dashboard/mit Service-Role sichtbar)
  zeigt gemeldete Profile, sortiert nach Anzahl der Meldungen.
- Ab **3 Meldungen von verschiedenen Personen** wird ein Profil automatisch ausgeblendet, bis du entscheidest.
- Entscheiden im SQL-Editor: `select moderate('<user-id>', 'ban' | 'dismiss' | 'verify');`
- Apple verlangt, dass Meldungen **innerhalb von 24 h** bearbeitet werden.
- Eingebauter Spam-Schutz: max. 500 Swipes und 5 Super-Likes pro Tag, max. 30 Nachrichten pro Minute.

### 3b. Test-Konto für Apples Prüfung
In Supabase unter Authentication → Users einen Nutzer **mit Passwort** anlegen (z. B. `review@deine-domain.de`).
In der App: „Mit Passwort anmelden“. Zugangsdaten in App Store Connect unter *App Review Information* eintragen.

### 4. Builds & Store
```bash
npm i -g eas-cli
eas login
eas init                       # verknüpft das Projekt, setzt extra.eas.projectId
eas build --platform all --profile production
eas submit --platform ios      # → TestFlight / App Store Connect
eas submit --platform android  # → Google Play (internal track)
```
Store-Texte, Screenshots-Liste und App-Review-Hinweise: siehe **STORE.md**.

## Vor dem Launch ausfüllen
- `src/constants/app.ts` – Firmenname, Adresse, Support-Mail, URLs
- `src/constants/legal.ts` – AGB/Datenschutz sind **Vorlagen** → anwaltlich prüfen lassen
- `app.json` – `bundleIdentifier` / `package` auf deine Domain ändern
- `eas.json` – `ascAppId`
- `store/screenshots/` – nach dem ersten Geräte-Build gegen echte Aufnahmen tauschen
- Demo-Bilder (`src/lib/demo-data.ts`, pravatar.cc / picsum.photos) sind nur Platzhalter für den Demo-Modus

## Projektstruktur
```
src/app/            Screens (Expo Router)
  (tabs)/           Entdecken · Likes · Chats · Profil
  auth, sign-in, onboarding
  profile/[id]      Ganzes Profil, Like auf Foto/Prompt mit Kommentar
  chat/[id]         Echtzeit-Chat mit Icebreakern & Ablauf-Timer
  match/[id]        „Es ist ein Match!“
  edit-profile, filters, settings, report/[id], legal/[doc]
src/components/     Swipe-Deck, Profilkarte, Profilansicht, Editoren, UI-Kit
src/lib/            Backend-Interface, Demo- & Supabase-Implementierung, Score-Algorithmus
supabase/           SQL-Schema mit RLS & RPCs, Push-Edge-Function
```

## Checks
```bash
npx tsc --noEmit && npx expo lint && npx jest && npx expo-doctor
```
Datenbank-Regeln (19 Prüfungen, braucht ein lokales Postgres):
```bash
psql -f supabase/tests/stub.sql && for f in supabase/migrations/*.sql; do psql -f "$f"; done && psql -f supabase/tests/rules.sql
```
Beides läuft automatisch in GitHub Actions (`.github/workflows/ci.yml`).

## Store-Screenshots
`store/screenshots/ios-6.9/` enthält 7 fertige Bilder im Format 1320 × 2868 (iPhone 6,9″, auch für Google Play nutzbar).
Sie sind aus der Web-Version aufgenommen; nach dem ersten TestFlight-Build am besten durch Aufnahmen vom echten Gerät ersetzen.

# Matchwerk 🔥 – Dating-App für Android

Eine vollständige Dating-App auf Basis von **Expo SDK 58 / React Native**, mit **Supabase** als Backend
(Auth, Postgres, Realtime-Chat, Storage, Push) – und einem **Offline-Demo-Modus**, der ohne Server sofort läuft.

## Was matchwerk besser macht als Tinder, Hinge & Bumble

| Feature | Tinder | Hinge | Bumble | **matchwerk** |
|---|---|---|---|---|
| Ein Profil nach dem anderen lesen (kein Karten-Wischen), Undo, Funken | – | ✅ | – | ✅ (Undo kostenlos) |
| Dating **und** Freunde in einer App | – | – | ✅ (BFF) | ✅ |
| Anderen Ort wählen (Reisemodus) | 💰 | – | 💰 | **kostenlos** |
| Standort aktualisiert sich beim Öffnen (z. B. zu Besuch) | ✅ | ✅ | ✅ | ✅ |
| Like auf ein Foto/eine Antwort + Kommentar | – | ✅ | – | ✅ |
| Wer schreibt zuerst? | – | – | nur Frauen | **jede:r wählt selbst** |
| Match läuft ab, 1× verlängerbar | – | – | ✅ | ✅ (48 h + 24 h) |
| Sehen, wer dich geliked hat | 💰 | 💰 | 💰 | **kostenlos** |
| Premium-Abo | ab ca. 10 € / Monat* | ab ca. 15 € / Monat* | ab ca. 15 € / Monat* | **ab 3,75 € / Monat** (Jahresabo) |
| Transparenter Match-Score mit Begründung | – | – | – | ✅ |
| Daily Spark (bestes Match des Tages zuerst) | – | ✅ (Most Compatible) | – | ✅ |
| Persönliche Icebreaker aus Gemeinsamkeiten | – | – | ✅ | ✅ |
| Absichten als Dealbreaker-Filter | – | ✅ | ✅ | ✅ |
| Kein Werbe-Tracking | – | – | – | ✅ |

Dazu: Anmeldung mit Google oder E-Mail (SMS und Apple vorbereitet, standardmäßig aus), Premium-Abo matchwerk+ mit Boosts, 8-stufiges Onboarding mit 18+-Prüfung, Profil-Vollständigkeit mit Tipps,
Profil pausieren, Melden & Blockieren überall, Sicherheits-Center, In-App-Kontolöschung, Dark Mode, Haptik.

*Konkurrenzpreise schwanken je nach Land, Alter und Laufzeit – vor jeder Werbeaussage aktuell prüfen.

## Schnellstart (Demo-Modus, ohne Server)

```bash
npm install
npx expo start
```
Im Browser `w` drücken oder mit einem Dev-Build auf dem Handy öffnen. Beliebige E-Mail + beliebigen Code eingeben.
Der Demo-Modus enthält 28 Beispielprofile in Berlin, simulierte Likes, Matches und Antworten im Chat.

## Produktion einrichten (Android / Google Play)

Matchwerk startet **nur auf Android**. Die iOS-Teile (Apple-Login, App-Store-Abos) sind im Code vorhanden,
aber ausgeschaltet bzw. nur auf iPhones aktiv – für eine spätere iOS-Version musst du nichts neu bauen.

**Kosten zum Start:** nur die einmaligen **25 $ für das Google-Play-Konto**. Alles andere ist in der Gratis-Stufe:

| Dienst | Gratis bis | Danach |
|---|---|---|
| Supabase (Datenbank, Login, Chat, Fotos) | ca. 50.000 aktive Nutzer/Monat, 500 MB DB | 25 $/Monat |
| RevenueCat (Abos) | 2.500 $ Umsatz/Monat | 1 % |
| Expo EAS (Builds) | ca. 30 Builds/Monat | – |
| Expo Push | unbegrenzt | – |
| Google-Login | unbegrenzt | – |
| Mailversand (Login-Codes) | Brevo-Gratis-Plan, 300 Mails/Tag | ab ca. 9 $/Monat |
| Webseite (Datenschutz, AGB) | GitHub Pages, unbegrenzt | – |
| SMS-Login | **nicht kostenlos** (3–10 Cent/SMS) – darum standardmäßig aus | – |

Hinweis: Ein Supabase-Gratis-Projekt wird nach 7 Tagen ohne Nutzung pausiert (im Dashboard mit einem Klick wieder an).

### 1. Supabase
1. Projekt auf <https://supabase.com> anlegen (Region **Frankfurt**).
2. Den Inhalt von `supabase/setup.sql` (alle Migrationen in einer Datei) im SQL-Editor einfügen und **Run** klicken (oder `supabase db push`).
3. **Login-Codes per E-Mail (kostenlos mit Brevo, 300 Mails/Tag):**
   - Brevo: Gratis-Plan wählen, Absender bestätigen, unter *SMTP & API* einen SMTP-Schlüssel erzeugen.
   - Supabase → Authentication → SMTP: Host `smtp-relay.brevo.com`, Port `587`, Login und Schlüssel aus Brevo.
   - Supabase → Authentication → Email Templates: bei **Confirm signup** *und* **Magic Link**
     Betreff `Dein Matchwerk-Code: {{ .Token }}` und einen Text mit `{{ .Token }}` (Code statt Link).
   - Supabase → Authentication → Sign In / Providers → **Confirm email aus** (der Code beweist die Adresse
     bereits; sonst bekommen neue Nutzer eine Link-Mail statt eines Codes).
   - Tester (z. B. Googles Prüfer) melden sich über „Anmeldung für Tester“ mit Passwort an.
4. `.env` anlegen (Vorlage `.env.example`) mit `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### 2. Google-Login (kostenlos)
1. <https://console.cloud.google.com> → neues Projekt → „OAuth-Zustimmungsbildschirm“ ausfüllen.
2. Unter Credentials zwei OAuth-Client-IDs anlegen:
   - **Web-Anwendung** → Client-ID und Secret in Supabase unter Authentication → Providers → Google eintragen.
   - **Android** → Paketname `app.matchwerk.dating` und SHA-1-Fingerabdruck (aus `npx eas-cli@latest credentials`
     sowie aus der Play Console unter „App-Signatur“).
3. Die Web-Client-ID in `.env` als `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` eintragen.

SMS-Login später einschalten: SMS-Anbieter in Supabase unter Providers → Phone eintragen und
`EXPO_PUBLIC_ENABLE_PHONE_LOGIN=true` setzen.

### 3. Bezahlsystem (Matchwerk+)
1. **Play Console** → deine App → Monetarisierung: alle 11 Produkte aus **STORE.md** anlegen
   (Matchwerk+ 9,99 / 44,99 / 69,99 €, VIP 17,99 / 79,99 / 119,99 €, Funken-Pakete, Boost-Pakete).
2. **Zahlungsprofil** in der Play Console anlegen (Bankkonto, Steuerdaten) – sonst keine Auszahlungen.
3. **RevenueCat** (<https://www.revenuecat.com>): Projekt anlegen, Google-Play-App verbinden (Service-Account-JSON),
   Entitlements `plus` und `vip`, Offering `default` mit allen 11 Produkten.
   Den öffentlichen Android-Key in `.env` als `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` eintragen.
4. **Webhook:** `supabase functions deploy revenuecat --no-verify-jwt`,
   `supabase secrets set REVENUECAT_WEBHOOK_SECRET=…`, dann in RevenueCat → Integrations → Webhooks die URL
   `https://<projekt>.supabase.co/functions/v1/revenuecat` und Header `Authorization: Bearer <secret>`.
5. Mit **Lizenztestern** (Play Console → Einstellungen → Lizenztests) kaufen, kündigen und wiederherstellen testen.

Google behält bei Abos **15 %**. Beispiel VIP 1 Monat 17,99 €: − 19 % USt. = 15,12 € − 15 % = **≈ 12,85 €** für dich;
Matchwerk+ 1 Monat 9,99 € → **≈ 7,14 €**.
Was Gratis-Nutzer bekommen, steht in `src/lib/plans.ts` und serverseitig verbindlich in `tier_limits()`
(`supabase/migrations/0005_tiers.sql`). Umsätze: RevenueCat-Dashboard oder Ansicht `revenue_daily`.

### 4. Push-Benachrichtigungen (kostenlos)
```bash
supabase functions deploy push --no-verify-jwt
supabase secrets set WEBHOOK_SECRET=<zufälliger-string>
```
Dann unter Database → Webhooks zwei Webhooks (INSERT auf `messages` und `matches`) auf die Function zeigen lassen,
mit Header `x-webhook-secret`. Für Android braucht Expo-Push einen Firebase-Schlüssel (FCM, kostenlos):
Firebase-Projekt anlegen, `google-services.json` herunterladen und mit `npx eas-cli@latest credentials` hinterlegen.

### 5. Webseite mit Datenschutz, AGB und „Konto löschen“ (kostenlos)
Google Play verlangt öffentliche Links zur Datenschutzerklärung und zur Kontolöschung. Die Seiten werden aus
`src/constants/legal.ts` erzeugt und über GitHub Pages veröffentlicht:
1. Auf GitHub: Repository → **Settings → Pages → Source: „GitHub Actions“** (einmalig).
2. Actions → „Website …“ → **Run workflow** (läuft danach bei jeder Textänderung automatisch).
3. Adressen: `https://kopkeabke-afk.github.io/Matchwerk/datenschutz.html`, `…/agb.html`, `…/konto-loeschen.html`

Lokal ansehen: `npm run site` → Ordner `site/`.

### 6. Moderation
- Meldungen landen in `reports`. Die Ansicht **`moderation_queue`** (nur im Dashboard sichtbar) zeigt gemeldete Profile.
- Ab **3 Meldungen von verschiedenen Personen** wird ein Profil automatisch ausgeblendet, bis du entscheidest.
- Entscheiden im SQL-Editor: `select moderate('<user-id>', 'ban' | 'dismiss' | 'verify');`
- Spam-Schutz: max. 500 Swipes pro Tag, max. 30 Nachrichten pro Minute.

### 7. Build & Google Play
```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile preview      # APK zum Testen auf deinem Handy
npx eas-cli@latest build --platform android --profile production   # AAB für Google Play
```
In der Play Console:
1. App anlegen, Store-Eintrag mit den Texten aus **STORE.md** und den Bildern aus `store/screenshots/` füllen.
2. **Datenschutz-URL**, **Datensicherheit** (Antworten in STORE.md) und **Kontolöschungs-URL** eintragen.
3. **Altersfreigabe**-Fragebogen ausfüllen (Dating → ab 18), Zielgruppe: nur Erwachsene.
4. **Geschlossener Test:** Neue private Konten müssen die App **14 Tage mit mindestens 12 Testern** testen,
   bevor sie öffentlich gehen darf. Tester per E-Mail-Liste einladen.
5. Danach Produktion beantragen. Für automatische Uploads: Service-Account-JSON als
   `google-play-service-account.json` ins Projekt legen (ist in `.gitignore`) und
   `npx eas-cli@latest submit --platform android` ausführen.

## Vor dem Launch ausfüllen
- `src/constants/app.ts` – Firmenname, Adresse, Support-Mail, URLs
- `src/constants/legal.ts` – AGB/Datenschutz sind **Vorlagen** → anwaltlich prüfen lassen
- `app.json` – Paketname `app.matchwerk.dating` (nach dem ersten Upload nicht mehr änderbar)
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
Live-Prüfung gegen dein echtes Supabase-Projekt (mit einem Test-Konto):
```bash
node scripts/check-supabase.cjs <test-email> <test-passwort>
```

Datenbank-Regeln lokal (35 Prüfungen, braucht ein lokales Postgres):
```bash
psql -f supabase/tests/stub.sql && for f in supabase/migrations/*.sql; do psql -f "$f"; done && psql -f supabase/tests/rules.sql
```
Beides läuft automatisch in GitHub Actions (`.github/workflows/ci.yml`).

## Store-Screenshots
`store/screenshots/phone/` enthält 7 fertige Bilder im Format 1320 × 2868 (iPhone 6,9″, auch für Google Play nutzbar).
Sie sind aus der Web-Version aufgenommen; nach dem ersten TestFlight-Build am besten durch Aufnahmen vom echten Gerät ersetzen.

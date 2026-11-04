# matchwerk 🔥 – Dating-App (iOS · Android · Web)

Eine vollständige Dating-App auf Basis von **Expo SDK 58 / React Native**, mit **Supabase** als Backend
(Auth, Postgres, Realtime-Chat, Storage, Push) – und einem **Offline-Demo-Modus**, der ohne Server sofort läuft.

## Was matchwerk besser macht als Tinder, Hinge & Bumble

| Feature | Tinder | Hinge | Bumble | **matchwerk** |
|---|---|---|---|---|
| Swipen mit Gesten, Undo, Super-Like | ✅ | – | ✅ | ✅ (Undo kostenlos) |
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

Dazu: Anmeldung mit Apple, Google, Telefonnummer (SMS) oder E-Mail, Premium-Abo matchwerk+ mit Boosts, 8-stufiges Onboarding mit 18+-Prüfung, Profil-Vollständigkeit mit Tipps,
Profil pausieren, Melden & Blockieren überall, Sicherheits-Center, In-App-Kontolöschung, Dark Mode, Haptik.

*Konkurrenzpreise schwanken je nach Land, Alter und Laufzeit – vor jeder Werbeaussage aktuell prüfen.

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
2. Alle Dateien aus `supabase/migrations/` der Reihe nach im SQL-Editor ausführen (oder `supabase db push`).
3. Auth → Providers → **Email** aktivieren, Template „Magic Link“ so anpassen, dass es `{{ .Token }}` (6-stelliger Code) enthält.
4. Auth → SMTP: eigenen Mail-Provider eintragen (Supabase-Standard ist stark limitiert).
5. `.env` anlegen (siehe `.env.example`) mit `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### 1b. Anmeldung (Apple, Google, Telefon, E-Mail)
| Methode | Was du einrichten musst | Kosten |
|---|---|---|
| **Telefonnummer** | Supabase → Auth → Providers → **Phone** aktivieren, SMS-Anbieter eintragen (Twilio, MessageBird oder Vonage) | ca. 0,05–0,10 € pro SMS |
| **Google** | Google Cloud Console → Credentials: OAuth-Client-IDs für **Web**, **iOS** und **Android** (SHA-1 aus `eas credentials`). Web-Client-ID + Secret in Supabase → Providers → Google eintragen. In `.env` beide Client-IDs, in `app.json` bei `@react-native-google-signin/google-signin` die `iosUrlScheme` (umgedrehte iOS-Client-ID) | kostenlos |
| **Apple** | Apple Developer → Identifiers → deine App-ID → „Sign in with Apple“ aktivieren. Supabase → Providers → Apple: Bundle-ID `app.matchwerk.dating` als Client-ID eintragen | kostenlos |
| **E-Mail** | SMTP wie oben | je nach Anbieter |

Apple-Regel 4.8: Wer Google-Login anbietet, muss auf dem iPhone auch „Mit Apple anmelden“ anbieten – ist eingebaut.
Hinweis: Apple verlangt beim Löschen eines Kontos, das per Apple angemeldet wurde, dass das Apple-Token widerrufen wird.
Supabase erledigt das, wenn unter Providers → Apple der Secret Key (.p8) hinterlegt ist.

### 1c. Bezahlsystem (matchwerk+) einrichten
Digitale Abos müssen in iOS/Android-Apps über Apple bzw. Google abgerechnet werden. matchwerk nutzt dafür **RevenueCat**
(kostenlos bis 2.500 $ Monatsumsatz, danach 1 %).

1. **App Store Connect** → deine App → Abonnements: Gruppe „matchwerk+“ mit den Produkten `matchwerk_plus_1m`, `matchwerk_plus_6m`, `matchwerk_plus_12m`.
   Unter In-App-Käufe (Verbrauchsartikel): `matchwerk_boost_1`, `matchwerk_boost_5`. Preise frei wählbar, Vorschlag: 7,99 € / 29,99 € / 44,99 € und 2,99 € / 9,99 €.
2. **Google Play Console** → Monetarisierung: dieselben Produkt-IDs anlegen.
3. **Apple Small Business Program** beantragen → Apple nimmt dann 15 % statt 30 %. Google nimmt bei Abos ohnehin 15 %.
4. **RevenueCat**: Projekt anlegen, beide Stores verbinden, Entitlement `plus` mit den drei Abo-Produkten,
   Offering `default` mit allen fünf Produkten. Die öffentlichen API-Keys in `.env` eintragen.
5. **Webhook**: `supabase functions deploy revenuecat --no-verify-jwt`, `supabase secrets set REVENUECAT_WEBHOOK_SECRET=…`,
   in RevenueCat → Integrations → Webhooks die URL `https://<projekt>.supabase.co/functions/v1/revenuecat` und
   Header `Authorization: Bearer <secret>` eintragen.
6. Testen mit Sandbox-Konten (Apple) bzw. Lizenztestern (Google).

Was Gratis-Nutzer bekommen und was matchwerk+ freischaltet, steht in `src/lib/plans.ts` und (serverseitig verbindlich) in
`plan_limits()` in `supabase/migrations/0003_premium.sql`. Umsätze siehst du in der Ansicht `revenue_daily`
und im RevenueCat-Dashboard.

**Was bei dir ankommt** (Beispiel 6-Monats-Abo für 29,99 € in Deutschland):
29,99 € − 19 % USt. = 25,20 € − 15 % Store-Gebühr = **≈ 21,42 €** (abzüglich ggf. 1 % RevenueCat).

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
Datenbank-Regeln (35 Prüfungen, braucht ein lokales Postgres):
```bash
psql -f supabase/tests/stub.sql && for f in supabase/migrations/*.sql; do psql -f "$f"; done && psql -f supabase/tests/rules.sql
```
Beides läuft automatisch in GitHub Actions (`.github/workflows/ci.yml`).

## Store-Screenshots
`store/screenshots/ios-6.9/` enthält 7 fertige Bilder im Format 1320 × 2868 (iPhone 6,9″, auch für Google Play nutzbar).
Sie sind aus der Web-Version aufgenommen; nach dem ersten TestFlight-Build am besten durch Aufnahmen vom echten Gerät ersetzen.

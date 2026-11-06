# Google Play – Store-Eintrag & Freigabe

## Store-Eintrag (Play Console → Haupteintrag im Play Store)

**App-Name (max. 30):** Matchwerk: Dating & Treffen
**Kurzbeschreibung (max. 80):** Dating, neue Freunde & gemeinsame Aktivitäten in deiner Nähe – für jedes Alter.
**Kategorie:** Dating · **Tags:** Dating, Partnersuche, Soziales, Freizeit

**Vollständige Beschreibung (max. 4000):**
Matchwerk ist die App für Menschen, die mehr wollen als endloses Durchklicken: Dating, neue Freundschaften und gemeinsame Aktivitäten in deiner Nähe.

• Transparenter Match-Score: Du siehst, was ihr gemeinsam habt – Interessen, Absichten, Nähe.
• Like, was dich wirklich anspricht: ein bestimmtes Foto oder eine Antwort, gern mit Kommentar.
• Du entscheidest, wer zuerst schreibt – du, dein Match oder egal.
• Kostenlos sehen, wer dich geliked hat.
• Daily Spark: Jeden Tag dein kompatibelstes Profil zuerst.
• Aktivitäten mit Gruppenchat: Wandern, Spieleabend, Kaffee – mitmachen oder selbst anbieten, für jedes Alter.
• Gemeinsam hingehen: Lade dein Match zu einer Aktivität ein – ein entspanntes erstes Treffen in der Gruppe.
• Sprachnachrichten: Sag es einfach – bis zu 60 Sekunden, direkt im Chat.
• Persönliche Gesprächsstarter, damit das erste „Hey“ nie wieder schwer ist.
• Klare Absichten: von „Feste Beziehung“ bis „Neue Freundschaften“ – als Filter nutzbar.
• Sicherheit zuerst: verifizierte Profile, Melden & Blockieren in jedem Chat, Sicherheits-Center.
• Kein Werbe-Tracking.

Matchwerk ist kostenlos. Optional gibt es Matchwerk+ (mehr Profile pro Tag, unbegrenzte Likes, 3 Funken am Tag, monatlicher Boost)
und Matchwerk VIP (unbegrenzt Profile, 7 Funken am Tag, wöchentlicher Boost, bevorzugte Anzeige). Funken und Boosts gibt es auch einzeln. Abos verlängern sich automatisch und sind jederzeit in Google Play kündbar.

Nur für Personen ab 18 Jahren.

**Grafiken:**
- App-Symbol 512 × 512 → aus `assets/images/icon.png` verkleinern
- Feature-Grafik 1024 × 500 → noch zu erstellen
- Smartphone-Screenshots → `store/screenshots/phone/` (1320 × 2868, für Google Play geeignet; 2–8 Stück)

## App-Inhalte (Play Console → Richtlinien → App-Inhalte)

| Punkt | Antwort |
|---|---|
| Datenschutzerklärung | `https://kopkeabke-afk.github.io/Matchwerk/datenschutz.html` |
| Kontolöschung (URL) | `https://kopkeabke-afk.github.io/Matchwerk/konto-loeschen.html` |
| Werbung | Nein, die App enthält keine Werbung |
| App-Zugriff | Eingeschränkt → Test-Konto angeben (siehe unten) |
| Altersfreigabe | Fragebogen: Kategorie „Soziale Netzwerke / Dating“, Nutzerinteraktion ja, Teilen des Standorts (ungefähr) ja |
| Zielgruppe | Nur 18+ |
| Nachrichten-App / Gesundheit / Finanzen | Nein |

## Datensicherheit (Data Safety)

Erhobene Daten (alle **verschlüsselt übertragen**, **Löschung möglich**, **nicht weitergegeben**, **kein Tracking**):

| Datentyp | Zweck | Optional? |
|---|---|---|
| Name, E-Mail-Adresse, Nutzer-ID | App-Funktionen, Kontoverwaltung | nein |
| Telefonnummer (nur bei SMS-Login) | Kontoverwaltung | ja |
| Ungefährer Standort | App-Funktionen | ja |
| Fotos | App-Funktionen | nein |
| Sexuelle Orientierung (aus Präferenzen) | App-Funktionen | nein |
| Andere Nutzerinhalte (Nachrichten, Profiltexte) | App-Funktionen | nein |
| Kaufverlauf | App-Funktionen | ja |
| Absturzdaten | – (nicht erhoben) | – |

## Test-Konto für die Google-Prüfung
In Supabase unter Authentication → Users einen Nutzer **mit Passwort** anlegen (z. B. `review@…`) und
3–5 Testprofile in der Nähe. In der App: „Los geht's“ → „Anmeldung für Tester“.
Zugangsdaten in der Play Console unter „App-Zugriff“ eintragen. Anleitung für die Prüfer: Startbildschirm → „Los geht's“ → „Anmeldung für Tester“.

## Geschlossener Test (Pflicht für neue private Konten)
Mindestens **12 Tester** müssen die App **14 Tage** lang installiert haben, bevor du die Produktion beantragen kannst.
Play Console → Testen → Geschlossener Test → Tester per E-Mail-Liste hinzufügen → Link teilen.

## In-App-Produkte (Play Console → Monetarisierung)
| Produkt-ID | Typ | Preis | Name |
|---|---|---|---|
| matchwerk_plus_1m | Abo, monatlich | 11,99 € | Matchwerk+ (1 Monat) |
| matchwerk_plus_6m | Abo, alle 6 Monate | 59,99 € | Matchwerk+ (6 Monate) |
| matchwerk_plus_12m | Abo, jährlich | 107,88 € | Matchwerk+ (12 Monate) |
| matchwerk_vip_1m | Abo, monatlich | 19,99 € | Matchwerk VIP (1 Monat) |
| matchwerk_vip_6m | Abo, alle 6 Monate | 99,99 € | Matchwerk VIP (6 Monate) |
| matchwerk_vip_12m | Abo, jährlich | 179,88 € | Matchwerk VIP (12 Monate) |
| matchwerk_funken_1 | In-App-Produkt (verbrauchbar) | 1,49 € | 1 Funke |
| matchwerk_funken_5 | In-App-Produkt (verbrauchbar) | 5,99 € | 5 Funken |
| matchwerk_funken_15 | In-App-Produkt (verbrauchbar) | 14,99 € | 15 Funken |
| matchwerk_boost_1 | In-App-Produkt (verbrauchbar) | 3,99 € | 1 Boost |
| matchwerk_boost_5 | In-App-Produkt (verbrauchbar) | 14,99 € | 5 Boosts |

RevenueCat: Entitlements `plus` (die drei Plus-Abos) und `vip` (die drei VIP-Abos), Offering `default` mit allen 11 Produkten.

## Später: iOS / App Store
Der Code unterstützt iOS bereits (inkl. „Mit Apple anmelden“, das Apple bei Google-Login verlangt).
Dafür nötig: Apple Developer Program (99 $/Jahr), dieselben Produkte in App Store Connect, Apple-Provider in Supabase.

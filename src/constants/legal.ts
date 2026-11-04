import { APP } from './app';

/**
 * ⚠️ TEMPLATES – have them reviewed by a lawyer and fill in the placeholders before launch.
 * They cover the points Apple/Google and the GDPR require for a dating app.
 */
export const LEGAL: Record<string, { title: string; sections: [string, string][] }> = {
  terms: {
    title: 'Nutzungsbedingungen',
    sections: [
      ['1. Geltungsbereich', `Diese Bedingungen regeln die Nutzung der App ${APP.name}, betrieben von ${APP.company}, ${APP.address}.`],
      ['2. Mindestalter', 'Die Nutzung ist ausschließlich Personen ab 18 Jahren gestattet. Mit der Registrierung bestätigst du, volljährig zu sein.'],
      ['3. Verhaltensregeln – Null Toleranz', 'Verboten sind: Belästigung, Hassrede, Drohungen, sexuelle Inhalte ohne Einwilligung, Nacktbilder, Fake-Profile, Identitätsdiebstahl, Betrug ("Romance Scams"), Werbung, Spam, Prostitution sowie jede Form von Gewalt oder Ausbeutung. Verstöße führen zur sofortigen Sperrung.'],
      ['4. Inhalte von Nutzer:innen', 'Du bist für deine Inhalte verantwortlich und räumst uns die zum Betrieb notwendigen Nutzungsrechte ein. Wir prüfen gemeldete Inhalte innerhalb von 24 Stunden und entfernen rechtswidrige oder regelwidrige Inhalte und Konten.'],
      ['5. Melden & Blockieren', 'Du kannst jedes Profil jederzeit melden oder blockieren. Blockierte Personen können dich nicht mehr sehen oder kontaktieren.'],
      ['6. Abos und Käufe in der App', 'Matchwerk ist kostenlos nutzbar, mit Tageslimits für Profile, Likes und Funken. Optional gibt es die Abos Matchwerk+ und Matchwerk VIP (jeweils 1, 6 oder 12 Monate) sowie einzelne Funken und Boosts. Abgerechnet wird über deinen Google-Play- bzw. Apple-Account. Abos verlängern sich automatisch um die gewählte Laufzeit, wenn du sie nicht spätestens 24 Stunden vor Ablauf in deinen Store-Einstellungen kündigst. Erstattungen richten sich nach den Regeln von Google bzw. Apple. Gekaufte Funken und Boosts verfallen nicht, solange dein Konto besteht.'],
      ['7. Kündigung', 'Du kannst dein Konto jederzeit in den Einstellungen löschen. Alle personenbezogenen Daten werden dabei gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.'],
      ['8. Haftung', 'Wir überprüfen keine Vorstrafen. Triff dich mit Matches an öffentlichen Orten und informiere eine Vertrauensperson.'],
      ['9. Kontakt', APP.supportEmail],
    ],
  },
  privacy: {
    title: 'Datenschutzerklärung',
    sections: [
      ['Verantwortlicher', `${APP.company}, ${APP.address}, ${APP.supportEmail}`],
      ['Welche Daten wir verarbeiten', 'Je nach Anmeldeart E-Mail-Adresse, Telefonnummer oder die Kennung deines Apple- bzw. Google-Kontos; Profilangaben (Name, Geburtsdatum, Geschlecht, Präferenzen, Fotos, Texte, Interessen), ungefährer Standort (auf ca. 1 km gerundet), Likes, Matches, Nachrichten, Meldungen, Push-Token, Abo-Status und gekaufte Funken/Boosts (keine Zahlungsdaten – die verarbeiten ausschließlich Apple bzw. Google).'],
      ['Besondere Kategorien (Art. 9 DSGVO)', 'Angaben zu deiner sexuellen Orientierung ergeben sich aus deinen Präferenzen. Wir verarbeiten sie ausschließlich auf Grundlage deiner ausdrücklichen Einwilligung, um dir passende Profile zu zeigen. Du kannst die Einwilligung jederzeit durch Löschen deines Kontos widerrufen.'],
      ['Zwecke & Rechtsgrundlagen', 'Bereitstellung der Dating-Funktionen (Art. 6 Abs. 1 lit. b DSGVO), Sicherheit & Missbrauchsbekämpfung (lit. f), Einwilligung für Standort und Push-Benachrichtigungen (lit. a).'],
      ['Sichtbarkeit', 'Andere Nutzer:innen sehen dein Profil, dein Alter (nicht dein Geburtsdatum) und eine gerundete Entfernung – niemals deinen genauen Standort oder deine E-Mail-Adresse.'],
      ['Auftragsverarbeiter', 'Hosting & Datenbank: Supabase (Serverstandort EU). SMS-Versand: dein SMS-Anbieter (z. B. Twilio). Anmeldung mit Apple/Google: Apple bzw. Google. Abo-Verwaltung: RevenueCat. Push-Zustellung: Expo / Apple / Google. Mit allen bestehen Auftragsverarbeitungsverträge.'],
      ['Speicherdauer', 'Bis zur Löschung deines Kontos. Meldungen werden zur Missbrauchsbekämpfung bis zu 12 Monate pseudonymisiert aufbewahrt.'],
      ['Deine Rechte', 'Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Aufsichtsbehörde. Schreib uns an ' + APP.supportEmail + '.'],
      ['Kein Tracking', 'Wir verwenden kein Werbe-Tracking und verkaufen keine Daten.'],
    ],
  },
  safety: {
    title: 'Sicherheits-Center',
    sections: [
      ['Vor dem Date', 'Lerne dein Match im Chat oder per Videocall kennen. Teile keine Adresse, Bankdaten oder Passwörter. Niemand Seriöses fragt nach Geld.'],
      ['Beim ersten Treffen', 'Triff dich an einem öffentlichen Ort, organisiere deine An- und Abreise selbst und erzähle einer Vertrauensperson, wo du bist.'],
      ['Achte auf Warnsignale', 'Druck, schnell die Plattform zu wechseln, Geschichten über finanzielle Notlagen, widersprüchliche Angaben oder Fotos, die zu perfekt wirken.'],
      ['Melden & Blockieren', 'In jedem Profil und Chat findest du oben rechts die Optionen zum Melden und Blockieren. Meldungen sind anonym.'],
      ['Hilfe', 'Notruf: 110 / 112 · Hilfetelefon Gewalt gegen Frauen: 116 016 · Hilfetelefon Gewalt an Männern: 0800 1239900 · Telefonseelsorge: 0800 111 0 111'],
    ],
  },
};

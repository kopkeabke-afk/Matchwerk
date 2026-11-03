import type { Gender, Intention, Profile } from './types';

/**
 * Seed profiles for demo mode (no backend configured).
 * Portraits: pravatar.cc, scenery: picsum.photos – placeholders only, replace before launch.
 */
const face = (n: number) => `https://i.pravatar.cc/800?img=${n}`;
const scene = (seed: string) => `https://picsum.photos/seed/${seed}/800/1000`;

type Seed = [
  name: string, age: number, gender: Gender, img: number, city: string, km: number,
  intention: Intention, job: string, interests: string[], bio: string,
  prompts: [string, string][], verified?: boolean,
];

const SEEDS: Seed[] = [
  ['Lena', 27, 'woman', 5, 'Berlin', 3, 'long_term', 'UX Designerin', ['Design', 'Kaffee', 'Wandern', 'Fotografie', 'Hunde'],
    'Halb Pixel-Nerd, halb Bergziege. Suche jemanden für Flohmärkte am Samstag und Gipfel am Sonntag.',
    [['Ein perfekter Sonntag sieht so aus …', 'Flat White, Mauerpark-Flohmarkt, abends Pasta für zu viele Leute.'], ['Mein größter Green Flag:', 'Ich antworte auf Nachrichten. Wirklich.']], true],
  ['Sophie', 25, 'woman', 9, 'Berlin', 6, 'long_open', 'Ärztin in Weiterbildung', ['Laufen', 'Podcasts', 'Kochen', 'Reisen'],
    'Nachtdienst-erprobt und trotzdem Morgenmensch. Erkläre dir gern, warum du mehr Wasser trinken solltest.',
    [['Unpopuläre Meinung:', 'Rosinen gehören in Zimtschnecken.'], ['So gewinnst du mein Herz:', 'Bring mir nach dem Dienst einen Döner. Ohne Fragen.']], true],
  ['Mia', 29, 'woman', 10, 'Berlin', 2, 'short_open', 'Barkeeperin', ['Techno', 'Tanzen', 'Wein', 'Kunst'],
    'Ich mixe dir den Drink, der zu deinem Sternzeichen passt. Glaube aber nicht an Sternzeichen.',
    [['Ich schwöre, das ist wahr:', 'Ich habe mal für eine Band gekocht, deren Namen ich nicht verraten darf.'], ['Unser erstes Date:', 'Galerie-Eröffnung, danach Späti-Bänkchen.']]],
  ['Amara', 26, 'woman', 16, 'Berlin', 8, 'long_term', 'Software Engineerin', ['Tech', 'Brettspiele', 'Kochen', 'Sprachen', 'Reisen'],
    'Schreibe tagsüber TypeScript, abends Rezepte meiner Oma auf. Spreche 4 Sprachen, aber keine davon fließend Small-Talk.',
    [['Mein Talent, das niemand erwartet:', 'Ich kann jedes Brettspiel nach einmal Erklären gewinnen.'], ['Wir verstehen uns, wenn …', 'du Catan nicht persönlich nimmst.']], true],
  ['Clara', 28, 'woman', 19, 'Potsdam', 22, 'long_term', 'Lehrerin', ['Lesen', 'Schwimmen', 'Theater', 'Katzen'],
    'Korrigiere tagsüber Aufsätze und abends deine Grammatik (nur wenn du willst).',
    [['Mein Lieblingsort in der Stadt:', 'Die Bank am Heiligen See um 7 Uhr morgens.'], ['Ich suche jemanden, der …', 'mit mir in Buchläden die Zeit vergisst.']]],
  ['Jule', 24, 'woman', 20, 'Berlin', 4, 'short_fun', 'Studentin (Kunst)', ['Festivals', 'Kunst', 'Fotografie', 'Vegan'],
    'Blumenkranz-Person. Ja, auch außerhalb von Festivals.',
    [['Mein Guilty Pleasure:', 'Reality-TV mit Kommentar-Funktion (ich).'], ['Das Letzte, das mich zum Lachen gebracht hat:', 'Eine Taube, die versucht hat, eine ganze Brezel zu klauen.']]],
  ['Hannah', 30, 'woman', 21, 'Berlin', 11, 'long_term', 'Produktmanagerin', ['Klettern', 'Startups', 'Kaffee', 'Ski'],
    'Ich plane gern – außer Urlaube, die werden spontan.',
    [['So gewinnst du mein Herz:', 'Zeig mir deinen Lieblings-Boulderspot.'], ['Mein größter Green Flag:', 'Ich frage nach, wie dein Tag wirklich war.']], true],
  ['Nora', 27, 'woman', 23, 'Berlin', 5, 'long_open', 'Journalistin', ['Schreiben', 'Podcasts', 'Jazz', 'Wein'],
    'Ich stelle viele Fragen. Berufskrankheit.',
    [['Unpopuläre Meinung:', 'Jazz ist die beste Date-Musik und ich werde das verteidigen.'], ['Unser erstes Date:', 'Kleines Jazzlokal, eine Flasche Rotwein, zu lange geredet.']]],
  ['Emilia', 26, 'woman', 24, 'Berlin', 7, 'unsure', 'Barista', ['Kaffee', 'Pflanzen', 'Indie', 'Brunch'],
    'Ich kann dir sagen, was dein Kaffeegeschmack über dich verrät.',
    [['Ich schwöre, das ist wahr:', 'Ich habe 43 Pflanzen und jede hat einen Namen.'], ['Wir verstehen uns, wenn …', 'du Hafermilch nicht als Persönlichkeit hast.']]],
  ['Yuki', 25, 'woman', 25, 'Berlin', 9, 'friends', 'Illustratorin', ['Kunst', 'Gaming', 'Design', 'Katzen'],
    'Zeichne Comics über meine Katze. Sie ist berühmter als ich.',
    [['Mein Talent, das niemand erwartet:', 'Ich kann dich in 60 Sekunden als Comicfigur zeichnen.'], ['Mein Guilty Pleasure:', 'Animal Crossing bis 3 Uhr nachts.']], true],
  ['Marie', 31, 'woman', 26, 'Berlin', 14, 'long_term', 'Architektin', ['Design', 'Radfahren', 'Museen', 'Reisen'],
    'Ich bewerte Städte nach ihren Treppenhäusern.',
    [['Mein Lieblingsort in der Stadt:', 'Das Dach der Neuen Nationalgalerie bei Sonnenuntergang.'], ['Ich suche jemanden, der …', 'auch an Regentagen gern raus geht.']]],
  ['Lara', 23, 'woman', 27, 'Berlin', 3, 'short_open', 'Studentin (Psychologie)', ['Yoga', 'Meditation', 'Tanzen', 'Serien'],
    'Ich analysiere dich nicht. Ok, vielleicht ein bisschen.',
    [['So gewinnst du mein Herz:', 'Sei ehrlich – auch wenn es unbequem ist.'], ['Unpopuläre Meinung:', 'Montage sind eigentlich ganz okay.']]],
  ['Sara', 28, 'woman', 32, 'Berlin', 6, 'long_term', 'Tierärztin', ['Hunde', 'Wandern', 'Camping', 'Nachhaltigkeit'],
    'Mein Hund Bruno muss dich mögen. Spoiler: er mag alle.',
    [['Ein perfekter Sonntag sieht so aus …', 'Brandenburg, Zelt, Lagerfeuer, Bruno.'], ['Mein größter Green Flag:', 'Ich teile immer meine Pommes.']], true],
  ['Alina', 29, 'woman', 36, 'Berlin', 10, 'long_open', 'Marketing Lead', ['Mode', 'Brunch', 'Reisen', 'Fitness'],
    'Mehr Brunch-Reservierungen als Termine im Kalender.',
    [['Unser erstes Date:', 'Brunch. Natürlich. Du suchst den Ort aus, ich bewerte ihn.'], ['Ich schwöre, das ist wahr:', 'Ich war schon in 38 Ländern.']]],
  ['Jonas', 29, 'man', 12, 'Berlin', 4, 'long_term', 'Softwareentwickler', ['Tech', 'Klettern', 'Kochen', 'Brettspiele'],
    'Koche besser als ich code. Und ich code ziemlich gut.',
    [['Mein Talent, das niemand erwartet:', 'Ich backe Sauerteigbrot, das Leute zum Weinen bringt.'], ['So gewinnst du mein Herz:', 'Fordere mich zu einem Brettspiel heraus.']], true],
  ['Lukas', 31, 'man', 13, 'Berlin', 7, 'long_open', 'Schreiner', ['Design', 'Camping', 'Craft Beer', 'Hunde'],
    'Baue Möbel und manchmal Luftschlösser.',
    [['Ich schwöre, das ist wahr:', 'Mein Bart hat einen eigenen Kamm. Und einen Namen.'], ['Unser erstes Date:', 'Craft-Beer-Tasting, ich erkläre zu viel über Hopfen.']]],
  ['Felix', 27, 'man', 11, 'Berlin', 3, 'short_open', 'Musiker', ['Musik machen', 'Konzerte', 'Indie', 'Festivals'],
    'Spiele Gitarre in einer Band, die du noch nicht kennst. Noch.',
    [['Mein Guilty Pleasure:', 'ABBA. In voller Lautstärke.'], ['Wir verstehen uns, wenn …', 'du mir Songs schickst, statt Memes.']]],
  ['Elias', 28, 'man', 14, 'Berlin', 9, 'short_fun', 'Fotograf', ['Fotografie', 'Reisen', 'Surfen', 'Kaffee'],
    'Ich mache das beste Foto von dir, das es je gab. Versprochen.',
    [['Mein Lieblingsort in der Stadt:', 'Tempelhofer Feld, wenn die Drachen fliegen.'], ['Unpopuläre Meinung:', 'Filmkameras sind besser als jedes iPhone.']]],
  ['Noah', 30, 'man', 15, 'Berlin', 5, 'unsure', 'Comedian', ['Theater', 'Podcasts', 'Serien', 'Filme'],
    'Ich bringe dich zum Lachen oder gebe dir dein Geld zurück.',
    [['Das Letzte, das mich zum Lachen gebracht hat:', 'Mein eigener Witz. Niemand sonst hat gelacht.'], ['So gewinnst du mein Herz:', 'Lach über meine schlechten Witze.']], true],
  ['Ben', 32, 'man', 18, 'Berlin', 12, 'long_term', 'Unternehmensberater', ['Laufen', 'Tennis', 'Wein', 'Startups'],
    'Laufe Marathons, aber nicht vor Gefühlen weg.',
    [['Ich suche jemanden, der …', 'mit mir sonntags zum Bäcker läuft – oder joggt.'], ['Mein größter Green Flag:', 'Ich merke mir, wie du deinen Kaffee trinkst.']]],
  ['David', 26, 'man', 51, 'Berlin', 6, 'long_open', 'Modedesigner', ['Mode', 'Kunst', 'Tanzen', 'Jazz'],
    'Hüte sind kein Accessoire, sie sind eine Lebenseinstellung.',
    [['Unser erstes Date:', 'Vintage-Läden in Neukölln, danach Tanzen.'], ['Ich schwöre, das ist wahr:', 'Ich besitze 27 Hüte.']], true],
  ['Max', 29, 'man', 53, 'Berlin', 8, 'long_term', 'Grundschullehrer', ['Fußball', 'Kochen', 'Pflanzen', 'Brettspiele'],
    'Erkläre Bruchrechnung mit Pizza. Funktioniert auch bei Erwachsenen.',
    [['Ein perfekter Sonntag sieht so aus …', 'Lange schlafen, Pancakes, Tatort mit Freunden.'], ['So gewinnst du mein Herz:', 'Pflanzen-Ableger tauschen.']]],
  ['Tim', 27, 'man', 57, 'Berlin', 4, 'short_open', 'Physiotherapeut', ['Fitness', 'Yoga', 'Schwimmen', 'Meditation'],
    'Ich richte deinen Rücken und vielleicht auch dein Herz.',
    [['Mein Talent, das niemand erwartet:', 'Ich kann alle Bundesländer rückwärts aufzählen.'], ['Unpopuläre Meinung:', 'Stretching ist besser als Ausschlafen.']]],
  ['Samuel', 30, 'man', 59, 'Berlin', 10, 'long_term', 'Data Scientist', ['Tech', 'Lesen', 'Sprachen', 'Reisen'],
    'Ich habe die Wahrscheinlichkeit berechnet, dass wir uns verstehen. Sie ist hoch.',
    [['Ich suche jemanden, der …', 'mit mir über alles und nichts reden kann.'], ['Mein größter Green Flag:', 'Ich höre wirklich zu.']], true],
  ['Leon', 28, 'man', 60, 'Berlin', 5, 'friends', 'Koch', ['Kochen', 'Camping', 'Ski', 'Wein'],
    'Das Lächeln auf dem Foto gibt es auch in echt.',
    [['Unser erstes Date:', 'Ich koche, du bringst den Nachtisch.'], ['Mein Lieblingsort in der Stadt:', 'Markthalle Neun, Donnerstagabend.']]],
  ['Paul', 33, 'man', 68, 'Berlin', 13, 'long_open', 'Architekt', ['Design', 'Museen', 'Radfahren', 'Jazz'],
    'Ruhig, neugierig, mit einer Schwäche für Brutalismus.',
    [['Unpopuläre Meinung:', 'Beton kann wunderschön sein.'], ['Wir verstehen uns, wenn …', 'du gern ohne Ziel durch die Stadt läufst.']], true],
  ['Kim', 27, 'nonbinary', 33, 'Berlin', 6, 'long_open', 'Sounddesigner*in', ['Techno', 'Musik machen', 'Gaming', 'Kunst'],
    'Baue Klänge für Games und Synth-Sets für die Nacht.',
    [['Mein Talent, das niemand erwartet:', 'Ich kann jedes Geräusch mit dem Mund nachmachen.'], ['Unser erstes Date:', 'Plattenladen, danach Ramen.']], true],
  ['Robin', 25, 'nonbinary', 31, 'Berlin', 4, 'short_open', 'Florist*in', ['Pflanzen', 'Fotografie', 'Vegan', 'Indie'],
    'Ich rede mit Blumen. Sie hören besser zu als die meisten.',
    [['So gewinnst du mein Herz:', 'Ein einzelnes Gänseblümchen reicht.'], ['Ein perfekter Sonntag sieht so aus …', 'Botanischer Garten, Picknick, Indie-Playlist.']]],
];

function birthdateFor(age: number, i: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear() - age, (i * 5) % 12, 1 + ((i * 7) % 27));
  if (d > new Date(now.getFullYear() - age, now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export const DEMO_PROFILES: Profile[] = SEEDS.map((s, i) => {
  const [name, age, gender, img, city, km, intention, job, interests, bio, prompts, verified] = s;
  return {
    id: `demo-${i + 1}`,
    name,
    birthdate: birthdateFor(age, i),
    gender,
    interestedIn: gender === 'woman' ? 'men' : gender === 'man' ? 'women' : 'everyone',
    bio,
    photos: [face(img), scene(`${name}-a`), scene(`${name}-b`)],
    prompts: prompts.map(([question, answer]) => ({ question, answer })),
    interests,
    intention,
    job,
    city,
    heightCm: gender === 'man' ? 175 + ((i * 3) % 18) : 160 + ((i * 3) % 16),
    verified: !!verified,
    firstMove: gender === 'woman' && i % 3 === 0 ? 'me' : 'anyone',
    paused: false,
    distanceKm: km,
  };
});

/** Profiles that already liked the demo user (shown in "Likes" and instant match on like-back). */
export const DEMO_INCOMING_LIKES: { id: string; comment?: string; item?: { kind: 'photo' | 'prompt'; index: number } }[] = [
  { id: 'demo-2', comment: 'Okay, dein Lächeln auf dem ersten Foto ist unfair 😄', item: { kind: 'photo', index: 0 } },
  { id: 'demo-4' },
  { id: 'demo-7', comment: 'Wo ist dein Lieblingsspot? 🧗', item: { kind: 'prompt', index: 0 } },
  { id: 'demo-13' },
  { id: 'demo-15', comment: 'Brettspiel-Duell?', item: { kind: 'prompt', index: 1 } },
  { id: 'demo-19' },
  { id: 'demo-24' },
  { id: 'demo-27' },
];

export const DEMO_REPLIES = [
  'Haha, das gefällt mir 😄',
  'Erzähl mehr!',
  'Okay, du hast meine Aufmerksamkeit 👀',
  'Das klingt nach einem Plan. Wann hast du Zeit?',
  'Ich wusste, dass wir uns verstehen würden.',
  'Gute Frage … lass mich kurz überlegen 🤔',
  'Wie war eigentlich dein Tag?',
];

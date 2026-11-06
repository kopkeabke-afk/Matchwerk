/**
 * What people can tell about themselves (Eigenschaften) and what matters to them (Prefs).
 * Everything is optional: unknown values are simply left out of the match score.
 * Deliberately no religion, politics or health data (special categories under GDPR).
 */
import type { Gender } from './types';

export type Choice = { id: string; label: string; emoji?: string };

export interface Traits {
  hasKids?: 'no' | 'yes';
  kidsWish?: 'want' | 'open' | 'no';
  smoking?: 'never' | 'sometimes' | 'yes';
  drinking?: 'never' | 'social' | 'often';
  sport?: 'never' | 'sometimes' | 'often' | 'daily';
  diet?: 'all' | 'flexi' | 'vegetarian' | 'vegan';
  pets?: string[]; // dog, cat, other, none, allergic
  personality?: 'intro' | 'ambi' | 'extro';
  rhythm?: 'early' | 'flexible' | 'night';
  education?: 'school' | 'apprenticeship' | 'degree' | 'phd';
  languages?: string[];
  /** Das kann ich gut */
  skills?: string[];
}

/** Things that can be marked as important; they count more in the match score. */
export type ImportantKey = 'kids' | 'smoking' | 'sport' | 'drinking' | 'diet' | 'pets' | 'personality' | 'rhythm' | 'education'
  | 'languages' | 'interests' | 'height' | 'intention' | 'distance';

export interface Prefs {
  heightMin?: number;
  heightMax?: number;
  /** dealbreakers: hide people who don't fit */
  nonSmokerOnly?: boolean;
  kidsMatch?: boolean;
  /** what counts more for this person */
  important?: ImportantKey[];
}

export const GENDER_DETAILS = ['Cis', 'Trans', 'Inter*', 'Divers', 'Genderfluid', 'Agender', 'Genderqueer', 'Bigender'];

export const SEEKING_LABELS: Record<Gender, string> = { woman: 'Frauen', man: 'Männer', nonbinary: 'Nicht-binäre Menschen' };

export const TRAIT_FIELDS: { key: Exclude<keyof Traits, 'pets' | 'languages' | 'skills'>; title: string; options: Choice[] }[] = [
  { key: 'hasKids', title: 'Kinder', options: [{ id: 'no', label: 'Keine Kinder' }, { id: 'yes', label: 'Habe Kinder' }] },
  { key: 'kidsWish', title: 'Kinderwunsch', options: [{ id: 'want', label: 'Möchte (mehr) Kinder' }, { id: 'open', label: 'Offen' }, { id: 'no', label: 'Möchte keine (weiteren)' }] },
  { key: 'smoking', title: 'Rauchen', options: [{ id: 'never', label: 'Nichtraucher:in', emoji: '🚭' }, { id: 'sometimes', label: 'Gelegentlich' }, { id: 'yes', label: 'Raucher:in' }] },
  { key: 'drinking', title: 'Alkohol', options: [{ id: 'never', label: 'Nie' }, { id: 'social', label: 'Gesellig' }, { id: 'often', label: 'Gern & oft' }] },
  { key: 'sport', title: 'Sport', options: [{ id: 'never', label: 'Eher nicht' }, { id: 'sometimes', label: 'Ab und zu' }, { id: 'often', label: 'Oft' }, { id: 'daily', label: 'Fast täglich' }] },
  { key: 'diet', title: 'Ernährung', options: [{ id: 'all', label: 'Esse alles' }, { id: 'flexi', label: 'Flexitarisch' }, { id: 'vegetarian', label: 'Vegetarisch' }, { id: 'vegan', label: 'Vegan' }] },
  { key: 'personality', title: 'Typ', options: [{ id: 'intro', label: 'Eher ruhig' }, { id: 'ambi', label: 'Mal so, mal so' }, { id: 'extro', label: 'Gesellig' }] },
  { key: 'rhythm', title: 'Rhythmus', options: [{ id: 'early', label: 'Frühaufsteher:in' }, { id: 'flexible', label: 'Flexibel' }, { id: 'night', label: 'Nachteule' }] },
  { key: 'education', title: 'Ausbildung', options: [{ id: 'school', label: 'Schulabschluss' }, { id: 'apprenticeship', label: 'Ausbildung' }, { id: 'degree', label: 'Studium' }, { id: 'phd', label: 'Promotion' }] },
];

export const PET_OPTIONS: Choice[] = [
  { id: 'dog', label: 'Hund', emoji: '🐶' }, { id: 'cat', label: 'Katze', emoji: '🐱' }, { id: 'other', label: 'Andere Tiere', emoji: '🐰' },
  { id: 'none', label: 'Keine Tiere' }, { id: 'allergic', label: 'Tierhaarallergie' },
];
export const LANGUAGE_OPTIONS = ['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch', 'Türkisch', 'Polnisch', 'Russisch', 'Arabisch', 'Ukrainisch', 'Niederländisch', 'Gebärdensprache'];
export const SKILL_OPTIONS = [
  'Kochen', 'Backen', 'Handwerk', 'Gärtnern', 'Musik machen', 'Singen', 'Tanzen', 'Fotografie', 'Zeichnen & Malen', 'Reparieren',
  'Organisieren', 'Zuhören', 'Witze erzählen', 'Programmieren', 'Nähen', 'Erste Hilfe', 'Autos & Technik', 'Pflanzen am Leben halten',
];

export const IMPORTANT_OPTIONS: { id: ImportantKey; label: string }[] = [
  { id: 'intention', label: 'Gleiche Absichten' }, { id: 'kids', label: 'Kinderwunsch' }, { id: 'interests', label: 'Gemeinsame Interessen' },
  { id: 'smoking', label: 'Rauchen' }, { id: 'sport', label: 'Sport' }, { id: 'drinking', label: 'Alkohol' }, { id: 'diet', label: 'Ernährung' },
  { id: 'pets', label: 'Tiere' }, { id: 'personality', label: 'Typ (ruhig / gesellig)' }, { id: 'rhythm', label: 'Rhythmus' },
  { id: 'education', label: 'Ausbildung' }, { id: 'languages', label: 'Sprachen' }, { id: 'height', label: 'Größe' }, { id: 'distance', label: 'Nähe' },
];

export const labelOf = (key: keyof Traits, id?: string) =>
  TRAIT_FIELDS.find((f) => f.key === key)?.options.find((o) => o.id === id)?.label;

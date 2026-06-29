// Shared domain model. A team goes through three stages that share this
// permissive shape: (1) raw AI output, (2) stored version enriched in EN
// (types/weaknesses added), (3) FR-localized version for display (name_fr,
// stats, move details…). Stage-specific fields are therefore optional.

export type EvKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type Evs = Partial<Record<EvKey, number>>;

// Base stats as returned by Tyradex (keys distinct from EVs).
export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spe_atk: number;
  spe_def: number;
  vit: number;
}

export interface Weakness {
  type: string;
  multiplier: number;
}

export interface Move {
  name: string;
  type?: string | null;
  // Display fields added by localizeTeam:
  power?: number | null;
  accuracy?: number | null;
  priority?: number;
  category?: string | null;
  effect?: string | null;
  strong_against?: string[];
  // Legacy migration field (old format):
  name_en?: string;
}

export interface TeamMon {
  name: string;
  role?: string | null;
  item?: string | null;
  ability?: string | null;
  nature?: string | null;
  tera_type?: string | null;
  evs?: Evs;
  moves?: (Move | string)[];
  note?: string | null;
  types?: string[];
  weaknesses?: Weakness[];
  // Display fields added by localizeTeam:
  name_en?: string;
  name_fr?: string | null;
  base_stats?: BaseStats | null;
  ability_effect?: string | null;
  item_effect?: string | null;
  resistances?: Weakness[];
  immunities?: string[];
  // Legacy migration fields:
  ability_en?: string;
}

export interface Team {
  strategy?: string | null;
  team: TeamMon[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface TeamVersion {
  team: Team;
  prompt: string;
  at: string;
}

export interface StoredTeam {
  savedAt: string;
  format: string;
  prompt: string;
  team: Team;
  name?: string;
  chat?: ChatMessage[];
  versions?: TeamVersion[];
  active?: number;
}

export interface Store {
  boxes: Record<string, string[]>; // slot name -> EN names
  teams: StoredTeam[];
}

// Localized entry for the UI (same format as StoredTeam, prose translated).
export type LocalizedEntry = StoredTeam;

// Item in the selection list (UI).
export interface PokemonListItem {
  id: number;
  en: string;
  fr: string | null;
  sprite: string | null;
  types: (string | null)[];
}

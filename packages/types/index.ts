// Modèle de domaine partagé. Une équipe traverse trois étapes qui partagent cette
// forme permissive : (1) sortie brute de l'IA, (2) version stockée enrichie en EN
// (types/faiblesses ajoutés), (3) version localisée FR pour l'affichage (name_fr,
// stats, détails d'attaque…). Les champs propres à chaque étape sont donc optionnels.

export type EvKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export type Evs = Partial<Record<EvKey, number>>;

// Stats de base telles que renvoyées par Tyradex (clés distinctes des EV).
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
  // Champs d'affichage ajoutés par localizeTeam :
  power?: number | null;
  accuracy?: number | null;
  priority?: number;
  category?: string | null;
  effect?: string | null;
  strong_against?: string[];
  // Champ de migration hérité (ancien format) :
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
  // Champs d'affichage ajoutés par localizeTeam :
  name_en?: string;
  name_fr?: string | null;
  base_stats?: BaseStats | null;
  ability_effect?: string | null;
  item_effect?: string | null;
  resistances?: Weakness[];
  immunities?: string[];
  // Champs de migration hérités :
  ability_en?: string;
}

export interface Team {
  strategy?: string | null;
  team: TeamMon[];
}

export type ChatMessage = { role: "user" | "assistant"; text: string };

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
  boxes: Record<string, string[]>; // nom du slot -> noms EN
  teams: StoredTeam[];
}

// Entrée localisée pour l'UI (format identique à StoredTeam, prose traduite).
export type LocalizedEntry = StoredTeam;

// Élément de la liste de sélection (UI).
export interface PokemonListItem {
  id: number;
  en: string;
  fr: string | null;
  sprite: string | null;
  types: (string | null)[];
}

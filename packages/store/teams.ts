// Generated teams: save, delete, rename, restorable versions and
// discussion thread. Everything is stored in canonical ENGLISH.
import { read, write } from "./read";
import type { Team } from "@poketeam/types";

export const getTeams = async () => (await read()).teams;

export async function saveTeam(entry: { format: string; prompt: string; team: Team }) {
  const s = await read();
  s.teams.unshift({ savedAt: new Date().toISOString(), ...entry });
  await write(s);
  return s.teams;
}

export async function deleteTeam(index: number) {
  const s = await read();
  if (index >= 0 && index < s.teams.length) {
    s.teams.splice(index, 1);
    await write(s);
  }

  return s.teams;
}

// New team version (following an edit) + trace in the discussion thread.
export async function addVersion(index: number, team: Team, prompt: string, note: string) {
  const s = await read();
  const t = s.teams.at(index);
  if (t) {
    const at = new Date().toISOString();
    (t.versions ??= []).unshift({ team, prompt, at });
    t.active = 0;
    t.team = team;
    t.savedAt = at;
    (t.chat ??= []).push({ role: "user", text: prompt }, { role: "assistant", text: note });
    await write(s);
  }

  return s.teams;
}

// Revert to a version: the active version becomes the requested one.
export async function setActiveVersion(index: number, v: number) {
  const s = await read();
  const t = s.teams.at(index);
  if (t?.versions && v >= 0 && v < t.versions.length) {
    t.active = v;
    t.team = t.versions[v].team;
    await write(s);
  }

  return s.teams;
}

export async function appendChat(index: number, user: string, assistant: string) {
  const s = await read();
  const t = s.teams.at(index);
  if (t) {
    (t.chat ??= []).push({ role: "user", text: user }, { role: "assistant", text: assistant });
    await write(s);
  }

  return s.teams;
}

export async function renameTeam(index: number, name: string) {
  const s = await read();
  if (index >= 0 && index < s.teams.length) {
    s.teams[index].name = name;
    await write(s);
  }

  return s.teams;
}

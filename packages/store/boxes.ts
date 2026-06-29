// Boxes: named slots of Pokémon (EN names). CRUD + duplication + renaming.
import { read, write } from "./read";

export const getBoxes = async () => (await read()).boxes;

export async function saveBox(name: string, mons: string[]) {
  const s = await read();
  s.boxes[name] = mons;
  await write(s);
  return s.boxes;
}

export async function deleteBox(name: string) {
  const s = await read();
  Reflect.deleteProperty(s.boxes, name);
  await write(s);
  return s.boxes;
}

export async function duplicateBox(name: string) {
  const s = await read();
  if (!(name in s.boxes)) return s.boxes;
  let to = `${name} (copie)`;
  for (let i = 2; to in s.boxes; i++) to = `${name} (copie ${i})`;
  s.boxes[to] = [...s.boxes[name]];
  await write(s);
  return s.boxes;
}

export async function renameBox(old: string, to: string) {
  const s = await read();
  if (old in s.boxes && old !== to) {
    s.boxes[to] = s.boxes[old];
    Reflect.deleteProperty(s.boxes, old);
    await write(s);
  }

  return s.boxes;
}

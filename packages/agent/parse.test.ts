// bun test
import { expect, test } from "bun:test";
import { parseTeam } from "./parse";

const team = { strategy: "s", team: [{ name_en: "Garchomp" }] };
const J = JSON.stringify(team);

test("bloc ```json", () => {
  expect(parseTeam("blabla\n```json\n" + J + "\n```\nSkipped: x")).toMatchObject(team);
});
test("bloc ``` simple", () => {
  expect(parseTeam("```\n" + J + "\n```")).toMatchObject(team);
});
test("JSON nu entouré de prose", () => {
  expect(parseTeam("Voici l'équipe: " + J + " voilà.")).toMatchObject(team);
});
test("pas de team -> null", () => {
  expect(parseTeam("désolé je n'ai pas pu")).toBeNull();
});
test("objet sans clé team -> null", () => {
  expect(parseTeam('```json\n{"foo":1}\n```')).toBeNull();
});

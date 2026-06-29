// Public surface of the package: everything the server consumes.
export { getBoxes, saveBox, deleteBox, duplicateBox, renameBox } from "./boxes";
export {
  getTeams,
  saveTeam,
  deleteTeam,
  renameTeam,
  addVersion,
  setActiveVersion,
  appendChat,
} from "./teams";

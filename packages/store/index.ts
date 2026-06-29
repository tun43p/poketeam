// Surface publique du package : tout ce que le serveur consomme.
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

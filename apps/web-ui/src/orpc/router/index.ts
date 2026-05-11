import { addTodo, listTodos } from "./todos";
import { agentHealth, openRepo, revealRepo, openTerm } from "./agent";
import { listDevices } from "./devices";

export default {
  listTodos,
  addTodo,
  agent: {
    health: agentHealth,
    open: openRepo,
    reveal: revealRepo,
    term: openTerm,
  },
  devices: {
    list: listDevices,
  },
};

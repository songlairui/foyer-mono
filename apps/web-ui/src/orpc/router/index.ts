import { addTodo, listTodos } from "./todos";
import { agentHealth, openRepo, revealRepo } from "./agent";
import { listDevices } from "./devices";

export default {
  listTodos,
  addTodo,
  agent: {
    health: agentHealth,
    open: openRepo,
    reveal: revealRepo,
  },
  devices: {
    list: listDevices,
  },
};

import { Config } from "./config.js"
import { State } from "./state.js"
import { Pos } from "./pos.js"
import { CellType } from "./cell.js"

export function updateRender() {
  for (let i = 0; i < Config.view_size; i++) {
    for (let j = 0; j < Config.view_size; j++) {
      let cell = State.view[i][j]
      let maze_x = State.player_pos.x - Math.floor(Config.view_size / 2) + i
      let maze_y = State.player_pos.y - Math.floor(Config.view_size / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      if (!(maze_pos.hash() in State.maze)) {
        cell.setAttribute("type", "wall")
      } else if (maze_pos.equals(State.player_pos)) {
        cell.setAttribute("type", "player")
      } else if (State.maze[maze_pos.hash()] === CellType.OPEN) {
        cell.setAttribute("type", "open")
      }
    }
  }
}
import { updateRender } from "./render.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"
import { generateMaze } from "./maze.js"
import { Pos } from "./pos.js"

export function handleInput(event) {
  let new_pos = State.player_pos.clone()
  switch (event.key) {
    case "ArrowUp":
      new_pos.x--
      break
    case "ArrowDown":
      new_pos.x++
      break
    case "ArrowLeft":
      new_pos.y--
      break
    case "ArrowRight":
      new_pos.y++
      break
  }

  // check if exists in maze
  if (!(new_pos.hash() in State.maze)) return

  if (State.maze[new_pos.hash()] === CellType.END) {
    State.floor++
    State.player_pos = new Pos(0, 0)
    generateMaze()
    updateRender()
    return
  }

  State.player_pos = new_pos
  updateRender()
}
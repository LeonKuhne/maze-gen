import { updateRender } from "./render.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"
import { generateMaze } from "./maze.js"
import { Pos } from "./pos.js"

export function movePlayer(dx, dy) {
  let new_pos = State.player_pos.clone()
  new_pos.x += dx
  new_pos.y += dy

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

export function handleInput(event) {
  switch (event.key) {
    case "ArrowUp":
      movePlayer(-1, 0)
      break
    case "ArrowDown":
      movePlayer(1, 0)
      break
    case "ArrowLeft":
      movePlayer(0, -1)
      break
    case "ArrowRight":
      movePlayer(0, 1)
      break
  }
}
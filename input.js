import { updateRender } from "./render.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"
import { generateMaze } from "./maze.js"
import { Pos } from "./pos.js"

export function movePlayer(dx, dy) {
  let new_pos = State.player_pos.clone()
  new_pos.x += dx
  new_pos.y += dy
  let nextHash = new_pos.hash()

  if (!(nextHash in State.maze)) return

  if (State.maze[nextHash] === CellType.DOOR) {
    let doorColor = State.doorColorByHash[nextHash]
    let matchingKeys = State.keyInventory[doorColor] ?? 0
    if (matchingKeys === 0) {
      return
    }
  }

  if (State.maze[nextHash] === CellType.KEY) {
    let keyColor = State.keyColorByHash[nextHash]
    State.keyInventory[keyColor] = (State.keyInventory[keyColor] ?? 0) + 1
    delete State.keyColorByHash[nextHash]
    State.maze[nextHash] = CellType.OPEN
  }

  if (State.maze[nextHash] === CellType.END) {
    State.floor++
    State.player_pos = new Pos(0, 0)
    State.playerMoveTick++
    generateMaze()
    updateRender()
    return
  }

  State.player_pos = new_pos
  State.playerMoveTick++
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
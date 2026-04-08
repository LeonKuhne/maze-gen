import { updateRender } from "./render.js"
import { State } from "./state.js"

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

  State.player_pos = new_pos
  updateRender()
}
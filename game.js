import { Pos } from "./pos.js"
import { handleInput } from "./input.js"
import { updateRender } from "./render.js"
import { Config } from "./config.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"

window.onload = function() {
  let game_grid = document.querySelector("#game-grid")
  game_grid.style.gridTemplateColumns = `repeat(${Config.view_size}, 1fr)`
  game_grid.style.gridTemplateRows = `repeat(${Config.view_size}, 1fr)`

  // add cells to grid
  for (let i = 0; i < Config.view_size; i++) {
    State.view[i] = []
    for (let j = 0; j < Config.view_size; j++) {
      let cell = document.createElement("cell")
      game_grid.appendChild(cell)
      State.view[i][j] = cell
    }
  }

  // fill maze
  let maze_cells = 10
  let num_cells = 0
  let stack = [State.player_pos.clone()]
  while (num_cells < maze_cells && stack.length > 0) {
    let pos = stack.pop()
    State.maze[pos.hash()] = CellType.OPEN
    num_cells++

    // shuffle directions
    let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    directions.sort(() => Math.random() - 0.5)

    for (let [dx, dy] of directions) {
      let new_pos = new Pos(pos.x + dx, pos.y + dy)
      if (!(new_pos.hash() in State.maze)) {
        stack.push(new_pos)
      }
    }
  } 

  // listen for movement keys
  document.addEventListener("keydown", function(event) {
    handleInput(event)
  })

  updateRender()
}
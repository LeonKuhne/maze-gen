import { handleInput } from "./input.js"
import { updateRender } from "./render.js"
import { Config } from "./config.js"
import { State } from "./state.js"
import { generateMaze } from "./maze.js"

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
  generateMaze()

  // listen for movement keys
  document.addEventListener("keydown", function(event) {
    handleInput(event)
  })

  updateRender()
}
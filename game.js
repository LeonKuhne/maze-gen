import { evaluateEnemyAttacks, handleInput, movePlayer, useWeaponAction } from "./input.js"
import { updateRender } from "./render.js"
import { Config } from "./config.js"
import { State } from "./state.js"
import { generateMaze } from "./maze.js"

function setupMobileControls() {
  let isMobile = window.matchMedia("(hover: none) and (pointer: coarse)").matches
  if (!isMobile) {
    return
  }

  let controls = document.querySelector("#mobile-controls")
  if (controls === null) {
    return
  }

  let directionByName = {
    up: [-1, 0],
    right: [0, 1],
    left: [0, -1],
    down: [1, 0]
  }

  let buttons = controls.querySelectorAll("button[data-direction]")
  for (let button of buttons) {
    let direction = button.dataset.direction
    if (!(direction in directionByName)) {
      continue
    }

    let [dx, dy] = directionByName[direction]
    let onPress = function(event) {
      event.preventDefault()
      movePlayer(dx, dy)
    }

    button.addEventListener("click", onPress)
    button.addEventListener("touchstart", onPress, { passive: false })
  }
}

function setupMobileActionButton() {
  let button = document.querySelector("#action-button")
  if (button === null) {
    return
  }

  let onPress = function(event) {
    event.preventDefault()
    useWeaponAction()
  }

  button.addEventListener("click", onPress)
  button.addEventListener("touchstart", onPress, { passive: false })
}

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

  setupMobileControls()
  setupMobileActionButton()

  updateRender()
  evaluateEnemyAttacks()
}
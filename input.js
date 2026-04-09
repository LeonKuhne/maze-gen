import { updateRender } from "./render.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"
import { generateMaze } from "./maze.js"
import { Pos } from "./pos.js"
import { Config } from "./config.js"

function getTotalKeysHeld() {
  return Object.values(State.keyInventory).reduce((sum, count) => sum + count, 0)
}

function dropLeastRecentKey() {
  if (State.keyPickupOrder.length === 0) {
    return
  }

  let playerHash = State.player_pos.hash()
  if (!(playerHash in State.maze) || State.maze[playerHash] !== CellType.OPEN) {
    return
  }

  let keyColor = State.keyPickupOrder[0]
  if (keyColor === undefined) {
    return
  }

  let currentCount = State.keyInventory[keyColor] ?? 0
  if (currentCount <= 0) {
    State.keyPickupOrder.shift()
    return
  }

  State.maze[playerHash] = CellType.KEY
  State.keyColorByHash[playerHash] = keyColor
  State.keyPickupOrder.shift()

  if (currentCount <= 1) {
    delete State.keyInventory[keyColor]
  } else {
    State.keyInventory[keyColor] = currentCount - 1
  }

  updateRender()
}

function setGameOverModalVisibility(isVisible) {
  let modal = document.querySelector("#game-over-modal")
  if (modal === null) {
    return
  }

  if (isVisible) {
    modal.removeAttribute("hidden")
  } else {
    modal.setAttribute("hidden", "")
  }
}

function setPauseModalVisibility(isVisible) {
  let modal = document.querySelector("#pause-modal")
  if (modal === null) {
    return
  }

  if (isVisible) {
    modal.removeAttribute("hidden")
  } else {
    modal.setAttribute("hidden", "")
  }
}

export function setPaused(isPaused) {
  if (State.gameOver) {
    return
  }

  State.isPaused = isPaused
  setPauseModalVisibility(isPaused)
  updateRender()
}

export function togglePause() {
  setPaused(!State.isPaused)
}

export function triggerGameOver() {
  if (State.gameOver) {
    return
  }

  State.gameOver = true
  State.hazardActive = false
  State.hazardColor = ""
  State.hazardElapsedMs = 0
  State.warningClearActive = false
  State.warningClearColor = ""
  State.warningClearElapsedMs = 0
  State.warningClearStartProgress = 0
  State.isPaused = false

  let finalScore = document.querySelector("#final-score")
  if (finalScore !== null) {
    finalScore.textContent = String(Math.max(0, State.floor - 1))
  }

  setGameOverModalVisibility(true)
  updateRender()
}

export function restartGame() {
  State.floor = 1
  State.player_pos = new Pos(0, 0)
  State.playerMoveTick = 0
  State.gameOver = false
  State.hazardActive = false
  State.hazardColor = ""
  State.hazardElapsedMs = 0
  State.warningClearActive = false
  State.warningClearColor = ""
  State.warningClearElapsedMs = 0
  State.warningClearStartProgress = 0
  State.isPaused = false

  generateMaze()
  setGameOverModalVisibility(false)
  setPauseModalVisibility(false)
  updateRender()
}

export function movePlayer(dx, dy) {
  if (State.gameOver || State.isPaused) {
    return
  }

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
    if (getTotalKeysHeld() < Config.max_keys_held) {
      let keyColor = State.keyColorByHash[nextHash]
      State.keyInventory[keyColor] = (State.keyInventory[keyColor] ?? 0) + 1
      State.keyPickupOrder.push(keyColor)
      delete State.keyColorByHash[nextHash]
      State.maze[nextHash] = CellType.OPEN
    }
  }

  if (State.maze[nextHash] === CellType.END) {
    State.floor++
    State.player_pos = new Pos(0, 0)
    State.playerMoveTick++
    State.hazardActive = false
    State.hazardColor = ""
    State.hazardElapsedMs = 0
    State.warningClearActive = false
    State.warningClearColor = ""
    State.warningClearElapsedMs = 0
    State.warningClearStartProgress = 0
    generateMaze()
    updateRender()
    return
  }

  State.player_pos = new_pos
  State.playerMoveTick++
  updateRender()
}

export function handleInput(event) {
  if (event.key === "Escape") {
    event.preventDefault()
    togglePause()
    return
  }

  if (event.key === " " || event.key === "Spacebar" || event.code === "Space") {
    event.preventDefault()
    if (State.gameOver) {
      restartGame()
    } else if (!State.isPaused) {
      dropLeastRecentKey()
    }
    return
  }

  if (State.gameOver || State.isPaused) {
    return
  }

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
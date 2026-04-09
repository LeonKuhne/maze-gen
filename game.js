import {
  handleInput,
  handleInputKeyUp,
  handleMobileScreenLongPress,
  handleMobileScreenShortPress,
  movePlayer,
  resetPrimaryPressState,
  setupShopControls,
  triggerGameOver,
  useMobileAbility
} from "./input.js"
import { updateRender } from "./render.js"
import { Config } from "./config.js"
import { State } from "./state.js"
import { generateMaze } from "./maze.js"
import { CellType } from "./cell.js"

let hazardTimerId = null
const WARNING_COLOR_COUNT = 64
const MOBILE_LONG_PRESS_MS = 350

function generateWarningColor() {
  let hue = Math.floor(((Math.random() * WARNING_COLOR_COUNT) % WARNING_COLOR_COUNT) * (360 / WARNING_COLOR_COUNT))
  return `hsl(${hue} 78% 54%)`
}

function getRandomSafetyEventColor() {
  let safetyColors = Array.from(new Set(Object.values(State.safetyColorByHash)))
  if (safetyColors.length === 0) {
    return generateWarningColor()
  }

  let randomIndex = Math.floor(Math.random() * safetyColors.length)
  return safetyColors[randomIndex]
}

function clearHazardWarningAnimated() {
  if (!State.hazardActive) {
    return
  }

  State.warningClearActive = true
  State.warningClearColor = State.hazardColor
  State.warningClearElapsedMs = 0
  State.warningClearStartProgress = Math.min(1, State.hazardElapsedMs / Math.max(1, Config.event_warning_duration_ms))

  State.hazardActive = false
  State.hazardColor = ""
  State.hazardElapsedMs = 0
  updateRender()
}

function isPlayerOnHomeTile() {
  let playerHash = State.player_pos.hash()
  if (!(playerHash in State.maze)) {
    return false
  }

  return State.maze[playerHash] === CellType.HOME
}

function isPlayerOnMatchingSafetyTile() {
  let playerHash = State.player_pos.hash()
  if (!(playerHash in State.maze)) {
    return false
  }

  if (State.maze[playerHash] !== CellType.SAFETY) {
    return false
  }

  return State.safetyColorByHash[playerHash] === State.hazardColor
}

function startHazardWarning() {
  let warningColor = getRandomSafetyEventColor()

  State.warningClearActive = false
  State.warningClearColor = ""
  State.warningClearElapsedMs = 0
  State.warningClearStartProgress = 0
  State.hazardActive = true
  State.hazardColor = warningColor
  State.hazardElapsedMs = 0
  updateRender()
}

function resolveHazardWarning() {
  if (isPlayerOnHomeTile() || isPlayerOnMatchingSafetyTile()) {
    clearHazardWarningAnimated()
    return
  }

  triggerGameOver()
}

function tickHazards() {
  if (State.gameOver || State.isPaused || State.isShopOpen) {
    return
  }

  if (State.warningClearActive) {
    State.warningClearElapsedMs += Config.hazard_check_ms
    if (State.warningClearElapsedMs >= Config.event_warning_clear_duration_ms) {
      State.warningClearActive = false
      State.warningClearColor = ""
      State.warningClearElapsedMs = 0
      State.warningClearStartProgress = 0
    }
    updateRender()
    return
  }

  if (!State.hazardActive) {
    if (Math.random() < Config.hazard_trigger_chance) {
      startHazardWarning()
    }
    return
  }

  if (isPlayerOnHomeTile() || isPlayerOnMatchingSafetyTile()) {
    clearHazardWarningAnimated()
    return
  }

  State.hazardElapsedMs += Config.hazard_check_ms
  if (State.hazardElapsedMs >= Config.event_warning_duration_ms) {
    resolveHazardWarning()
  } else {
    updateRender()
  }
}

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
      event.stopPropagation()
      movePlayer(dx, dy)
    }

    let ignoreClickUntil = 0
    button.addEventListener("touchstart", function(event) {
      ignoreClickUntil = Date.now() + 500
      onPress(event)
    }, { passive: false })
    button.addEventListener("click", function(event) {
      if (Date.now() < ignoreClickUntil) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      onPress(event)
    })
  }
}

function setupMobileItemControls() {
  let isMobile = window.matchMedia("(hover: none) and (pointer: coarse)").matches
  if (!isMobile) {
    return
  }

  let controls = document.querySelector("#mobile-item-controls")
  if (controls === null) {
    return
  }

  let ignoreClickUntil = 0

  controls.addEventListener("touchstart", function(event) {
    let target = event.target
    if (!(target instanceof Element)) {
      return
    }

    let button = target.closest("button[data-item]")
    if (!(button instanceof HTMLButtonElement)) {
      return
    }

    let item = button.dataset.item
    if (item !== "teleporter" && item !== "drill" && item !== "recall") {
      return
    }

    ignoreClickUntil = Date.now() + 500
    event.preventDefault()
    event.stopPropagation()
    useMobileAbility(item)
  }, { passive: false })

  controls.addEventListener("click", function(event) {
    let target = event.target
    if (!(target instanceof Element)) {
      return
    }

    let button = target.closest("button[data-item]")
    if (!(button instanceof HTMLButtonElement)) {
      return
    }

    if (Date.now() < ignoreClickUntil) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    let item = button.dataset.item
    if (item !== "teleporter" && item !== "drill" && item !== "recall") {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    useMobileAbility(item)
  })
}

function setupMobileScreenTap() {
  let isMobile = window.matchMedia("(hover: none) and (pointer: coarse)").matches
  if (!isMobile) {
    return
  }

  let ignoreClickUntil = 0
  let activeTouchTarget = null
  let longPressTriggered = false
  let longPressTimerId = null

  function clearLongPressTimer() {
    if (longPressTimerId !== null) {
      clearTimeout(longPressTimerId)
      longPressTimerId = null
    }
  }

  document.addEventListener("touchstart", function(event) {
    event.preventDefault()

    activeTouchTarget = event.target instanceof Element ? event.target : null
    longPressTriggered = false
    clearLongPressTimer()

    longPressTimerId = setTimeout(function() {
      if (activeTouchTarget === null) {
        return
      }

      longPressTriggered = true
      handleMobileScreenLongPress(activeTouchTarget)
    }, MOBILE_LONG_PRESS_MS)
  }, { passive: false })

  document.addEventListener("touchend", function(event) {
    event.preventDefault()
    ignoreClickUntil = Date.now() + 500

    clearLongPressTimer()

    if (!longPressTriggered && activeTouchTarget !== null) {
      handleMobileScreenShortPress(activeTouchTarget)
    }

    activeTouchTarget = null
    longPressTriggered = false
  }, { passive: false })

  document.addEventListener("touchcancel", function() {
    ignoreClickUntil = Date.now() + 500
    clearLongPressTimer()
    activeTouchTarget = null
    longPressTriggered = false
  }, { passive: false })

  document.addEventListener("click", function(event) {
    if (Date.now() < ignoreClickUntil) {
      event.preventDefault()
      return
    }

    let target = event.target
    if (target instanceof Element) {
      handleMobileScreenShortPress(target)
    }
  })
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
  document.addEventListener("keyup", function(event) {
    handleInputKeyUp(event)
  })

  setupMobileControls()
  setupMobileItemControls()
  setupMobileScreenTap()
  setupShopControls()

  if (hazardTimerId !== null) {
    clearInterval(hazardTimerId)
  }

  hazardTimerId = setInterval(function() {
    tickHazards()
  }, Config.hazard_check_ms)

  resetPrimaryPressState()

  updateRender()
}
import { updateRender } from "./render.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"
import { generateMaze } from "./maze.js"
import { Pos } from "./pos.js"
import { Config } from "./config.js"

const SPACE_LONG_PRESS_MS = 350

let isSpacePressActive = false
let isSpaceLongPressHandled = false
let spaceLongPressTimerId = null

function getTotalKeysHeld() {
  return Object.values(State.keyInventory).reduce((sum, count) => sum + count, 0)
}

function isModifierKey(event) {
  return event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta"
}

function getBindDisplay(code) {
  if (code === null) {
    return "unbound"
  }

  if (code.startsWith("Key")) {
    return code.slice(3).toLowerCase()
  }

  if (code.startsWith("Digit")) {
    return code.slice(5)
  }

  return code
}

function clearConflictingBinds(code, excludedItem) {
  if (excludedItem !== "teleporter" && State.teleporterBindCode === code) {
    State.teleporterBindCode = null
  }

  if (excludedItem !== "drill" && State.drillBindCode === code) {
    State.drillBindCode = null
  }

  if (excludedItem !== "recall" && State.recallBindCode === code) {
    State.recallBindCode = null
  }
}

function assignBind(item, code) {
  clearConflictingBinds(code, item)

  if (item === "teleporter") {
    State.teleporterBindCode = code
  } else if (item === "drill") {
    State.drillBindCode = code
  } else if (item === "recall") {
    State.recallBindCode = code
  }
}

function startBindCapture(item) {
  State.bindCaptureItem = item
  updateRender()
}

function tryHandleBindCapture(event) {
  if (State.bindCaptureItem === null) {
    return false
  }

  event.preventDefault()

  if (event.key === "Escape") {
    State.bindCaptureItem = null
    updateRender()
    return true
  }

  if (isModifierKey(event)) {
    return true
  }

  assignBind(State.bindCaptureItem, event.code)
  State.bindCaptureItem = null
  updateRender()
  return true
}

function spendCoins(cost) {
  if (State.coins < cost) {
    return false
  }

  State.coins -= cost
  return true
}

function purchaseAbility(kind) {
  if (kind === "teleporter") {
    if (State.teleporterUnlocked || !spendCoins(Config.teleporter_unlock_cost)) {
      return
    }

    State.teleporterUnlocked = true
    startBindCapture("teleporter")
    updateRender()
    return
  }

  if (kind === "drill") {
    if (State.drillUnlocked || !spendCoins(Config.drill_unlock_cost)) {
      return
    }

    State.drillUnlocked = true
    startBindCapture("drill")
    updateRender()
    return
  }

  if (kind === "recall") {
    if (State.recallUnlocked || !spendCoins(Config.recall_unlock_cost)) {
      return
    }

    State.recallUnlocked = true
    startBindCapture("recall")
    updateRender()
    return
  }

  if (kind === "joker-safety-view") {
    if (State.jokerSafetyViewUnlocked || !spendCoins(Config.joker_safety_view_upgrade_cost)) {
      return
    }

    State.jokerSafetyViewUnlocked = true
    updateRender()
  }
}

function clickAbilityButton(kind) {
  if (kind === "teleporter") {
    if (State.teleporterUnlocked) {
      startBindCapture("teleporter")
      return
    }
    purchaseAbility("teleporter")
    return
  }

  if (kind === "drill") {
    if (State.drillUnlocked) {
      startBindCapture("drill")
      return
    }
    purchaseAbility("drill")
    return
  }

  if (kind === "recall") {
    if (State.recallUnlocked) {
      startBindCapture("recall")
      return
    }
    purchaseAbility("recall")
    return
  }

  if (kind === "joker-safety-view") {
    purchaseAbility("joker-safety-view")
  }
}

export function setupShopControls() {
  let buyTeleporter = document.querySelector("#buy-teleporter")
  let buyDrill = document.querySelector("#buy-drill")
  let buyRecall = document.querySelector("#buy-recall")
  let buyJokerSafetyView = document.querySelector("#buy-joker-safety-view")

  if (buyTeleporter !== null) {
    buyTeleporter.addEventListener("click", function() {
      clickAbilityButton("teleporter")
    })
  }

  if (buyDrill !== null) {
    buyDrill.addEventListener("click", function() {
      clickAbilityButton("drill")
    })
  }

  if (buyRecall !== null) {
    buyRecall.addEventListener("click", function() {
      clickAbilityButton("recall")
    })
  }

  if (buyJokerSafetyView !== null) {
    buyJokerSafetyView.addEventListener("click", function() {
      clickAbilityButton("joker-safety-view")
    })
  }
}

function setTeleporterPoint(kind) {
  if (!State.teleporterUnlocked) {
    return
  }

  let playerHash = State.player_pos.hash()
  if (!(playerHash in State.maze)) {
    return
  }

  if (kind === "up") {
    State.teleporterUpHash = playerHash
  } else if (kind === "down") {
    State.teleporterDownHash = playerHash
  }

  updateRender()
}

function useTeleporterPlacementAction() {
  if (!State.teleporterUnlocked) {
    return
  }

  setTeleporterPoint(State.teleporterPlacementTarget)
  State.teleporterPlacementTarget = State.teleporterPlacementTarget === "up" ? "down" : "up"
  updateRender()
}

function useDrill() {
  if (!State.drillUnlocked) {
    return
  }

  if (!spendCoins(Config.drill_use_cost)) {
    return
  }

  let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (let [dx, dy] of directions) {
    let wallPos = new Pos(State.player_pos.x + dx, State.player_pos.y + dy)
    let wallHash = wallPos.hash()
    if (!(wallHash in State.maze)) {
      State.maze[wallHash] = CellType.OPEN
    }
  }

  updateRender()
}

function useRecall() {
  if (!State.recallUnlocked) {
    return
  }

  if (State.homeHash === null || !spendCoins(Config.recall_use_cost)) {
    return
  }

  let [x, y] = State.homeHash.split(",").map(Number)
  State.player_pos = new Pos(x, y)
  State.playerMoveTick++
  updateRender()
}

export function useMobileAbility(kind) {
  if (State.gameOver || State.isPaused || State.isShopOpen) {
    return
  }

  if (kind === "teleporter") {
    useTeleporterPlacementAction()
    return
  }

  if (kind === "drill") {
    useDrill()
    return
  }

  if (kind === "recall") {
    useRecall()
  }
}

function applyTeleporterIfNeeded() {
  if (State.teleporterUpHash === null || State.teleporterDownHash === null) {
    return
  }

  if (State.teleporterUpHash === State.teleporterDownHash) {
    return
  }

  let playerHash = State.player_pos.hash()
  if (playerHash === State.teleporterUpHash) {
    let [x, y] = State.teleporterDownHash.split(",").map(Number)
    State.player_pos = new Pos(x, y)
    State.playerMoveTick++
    return
  }

  if (playerHash === State.teleporterDownHash) {
    let [x, y] = State.teleporterUpHash.split(",").map(Number)
    State.player_pos = new Pos(x, y)
    State.playerMoveTick++
  }
}

function dropLeastRecentKey() {
  if (State.keyPickupOrder.length === 0) {
    return
  }

  let playerHash = State.player_pos.hash()
  if (!(playerHash in State.maze)) {
    return
  }

  let playerCellType = State.maze[playerHash]
  if (playerCellType !== CellType.OPEN && playerCellType !== CellType.KEY) {
    return
  }

  let keyColorToDrop = State.keyPickupOrder[0]
  if (keyColorToDrop === undefined) {
    return
  }

  let currentCount = State.keyInventory[keyColorToDrop] ?? 0
  if (currentCount <= 0) {
    State.keyPickupOrder.shift()
    return
  }

  if (playerCellType === CellType.KEY) {
    let keyColorToPickUp = State.keyColorByHash[playerHash]
    if (keyColorToPickUp === undefined) {
      return
    }

    State.keyPickupOrder.shift()

    if (currentCount <= 1) {
      delete State.keyInventory[keyColorToDrop]
    } else {
      State.keyInventory[keyColorToDrop] = currentCount - 1
    }

    State.keyColorByHash[playerHash] = keyColorToDrop
    State.keyInventory[keyColorToPickUp] = (State.keyInventory[keyColorToPickUp] ?? 0) + 1
    State.keyPickupOrder.push(keyColorToPickUp)
    updateRender()
    return
  }

  State.keyPickupOrder.shift()

  if (currentCount <= 1) {
    delete State.keyInventory[keyColorToDrop]
  } else {
    State.keyInventory[keyColorToDrop] = currentCount - 1
  }

  State.maze[playerHash] = CellType.KEY
  State.keyColorByHash[playerHash] = keyColorToDrop

  updateRender()
}

function isPlayerOnShopTile() {
  let playerHash = State.player_pos.hash()
  if (!(playerHash in State.maze)) {
    return false
  }

  return State.maze[playerHash] === CellType.SHOP
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

function setShopModalVisibility(isVisible) {
  let modal = document.querySelector("#shop-modal")
  if (modal === null) {
    return
  }

  if (isVisible) {
    modal.removeAttribute("hidden")
  } else {
    modal.setAttribute("hidden", "")
  }
}

export function setShopOpen(isOpen) {
  if (State.gameOver) {
    return
  }

  if (isOpen && !isPlayerOnShopTile()) {
    return
  }

  State.isShopOpen = isOpen

  if (isOpen) {
    State.isPaused = false
    setPauseModalVisibility(false)
  }

  setShopModalVisibility(isOpen)
  updateRender()
}

export function setPaused(isPaused) {
  if (State.gameOver) {
    return
  }

  if (isPaused && State.isShopOpen) {
    setShopOpen(false)
  }

  State.isPaused = isPaused
  setPauseModalVisibility(isPaused)
  updateRender()
}

export function togglePause() {
  setPaused(!State.isPaused)
}

function clearSpacePressTimer() {
  if (spaceLongPressTimerId !== null) {
    clearTimeout(spaceLongPressTimerId)
    spaceLongPressTimerId = null
  }
}

function startDesktopSpaceLongPress() {
  clearSpacePressTimer()
  spaceLongPressTimerId = setTimeout(function() {
    if (!isSpacePressActive || State.gameOver || State.isShopOpen) {
      return
    }

    setPaused(!State.isPaused)
    isSpaceLongPressHandled = true
  }, SPACE_LONG_PRESS_MS)
}

function runShortPrimaryAction() {
  if (State.gameOver) {
    restartGame()
    return
  }

  if (State.isShopOpen) {
    setShopOpen(false)
    return
  }

  if (State.isPaused) {
    setPaused(false)
    return
  }

  if (isPlayerOnShopTile()) {
    setShopOpen(true)
    return
  }

  dropLeastRecentKey()
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
  State.isShopOpen = false

  let finalScore = document.querySelector("#final-score")
  if (finalScore !== null) {
    finalScore.textContent = String(Math.max(0, State.floor - 1))
  }

  setGameOverModalVisibility(true)
  setShopModalVisibility(false)
  updateRender()
}

export function restartGame() {
  State.floor = 1
  State.player_pos = new Pos(0, 0)
  State.playerMoveTick = 0
  State.coins = 0
  State.gameOver = false
  State.hazardActive = false
  State.hazardColor = ""
  State.hazardElapsedMs = 0
  State.warningClearActive = false
  State.warningClearColor = ""
  State.warningClearElapsedMs = 0
  State.warningClearStartProgress = 0
  State.teleporterPlacementTarget = "up"
  State.teleporterUnlocked = false
  State.drillUnlocked = false
  State.recallUnlocked = false
  State.jokerSafetyViewUnlocked = false
  State.teleporterBindCode = null
  State.drillBindCode = null
  State.recallBindCode = null
  State.bindCaptureItem = null
  State.isPaused = false
  State.isShopOpen = false

  generateMaze()
  setGameOverModalVisibility(false)
  setPauseModalVisibility(false)
  setShopModalVisibility(false)
  updateRender()
}

export function movePlayer(dx, dy) {
  if (State.gameOver || State.isPaused || State.isShopOpen) {
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

  if (State.maze[nextHash] === CellType.COIN) {
    State.coins++
    State.maze[nextHash] = CellType.OPEN
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
  applyTeleporterIfNeeded()
  updateRender()
}

export function handleInput(event) {
  if (tryHandleBindCapture(event)) {
    return
  }

  if (event.key === "Escape") {
    event.preventDefault()
    if (State.isShopOpen) {
      setShopOpen(false)
    }
    return
  }

  if (event.key === " " || event.key === "Spacebar" || event.code === "Space") {
    event.preventDefault()
    if (event.repeat || State.bindCaptureItem !== null) {
      return
    }

    isSpacePressActive = true
    isSpaceLongPressHandled = false
    startDesktopSpaceLongPress()
    return
  }

  if (State.gameOver || State.isPaused || State.isShopOpen) {
    return
  }

  if (State.teleporterBindCode !== null && event.code === State.teleporterBindCode) {
    event.preventDefault()
    useTeleporterPlacementAction()
    return
  }

  if (State.drillBindCode !== null && event.code === State.drillBindCode) {
    event.preventDefault()
    useDrill()
    return
  }

  if (State.recallBindCode !== null && event.code === State.recallBindCode) {
    event.preventDefault()
    useRecall()
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

export function handleInputKeyUp(event) {
  if (!(event.key === " " || event.key === "Spacebar" || event.code === "Space")) {
    return
  }

  event.preventDefault()

  if (!isSpacePressActive) {
    return
  }

  isSpacePressActive = false
  clearSpacePressTimer()

  if (isSpaceLongPressHandled) {
    isSpaceLongPressHandled = false
    return
  }

  runShortPrimaryAction()
}

function isIgnoredMobileSurfaceTarget(target) {
  return (
    target.closest("#mobile-controls") !== null ||
    target.closest("#mobile-item-controls") !== null ||
    target.closest("#pause-dialog") !== null
  )
}

export function handleMobileScreenShortPress(target) {
  if (State.gameOver) {
    restartGame()
    return
  }

  if (!(target instanceof Element)) {
    return
  }

  if (isIgnoredMobileSurfaceTarget(target)) {
    return
  }

  if (State.isShopOpen) {
    if (target.closest("#shop-dialog") === null) {
      setShopOpen(false)
    }
    return
  }

  if (target.closest("#shop-dialog") !== null) {
    return
  }

  if (State.isPaused) {
    setPaused(false)
    return
  }

  if (isPlayerOnShopTile()) {
    setShopOpen(true)
    return
  }

  dropLeastRecentKey()
}

export function handleMobileScreenLongPress(target) {
  if (State.gameOver || State.isShopOpen) {
    return
  }

  if (!(target instanceof Element)) {
    return
  }

  if (isIgnoredMobileSurfaceTarget(target)) {
    return
  }

  if (!State.isPaused) {
    setPaused(true)
  }
}

export function resetPrimaryPressState() {
  isSpacePressActive = false
  isSpaceLongPressHandled = false
  clearSpacePressTimer()
}

export function handleMobileScreenTap(event) {
  if (!(event.target instanceof Element)) {
    return
  }

  handleMobileScreenShortPress(event.target)
}
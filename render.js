import { Config } from "./config.js"
import { State } from "./state.js"
import { Pos } from "./pos.js"
import { CellType } from "./cell.js"

function formatBindLabel(code) {
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

function getCurrentViewSize() {
  return State.view.length > 0 ? State.view.length : Config.view_size
}

function ensureViewGridSize(targetSize) {
  let gameGrid = document.querySelector("#game-grid")
  if (gameGrid === null) {
    return
  }

  if (State.view.length === targetSize && State.view.every((row) => row.length === targetSize)) {
    return
  }

  gameGrid.replaceChildren()
  gameGrid.style.gridTemplateColumns = `repeat(${targetSize}, 1fr)`
  gameGrid.style.gridTemplateRows = `repeat(${targetSize}, 1fr)`

  State.view = []
  for (let i = 0; i < targetSize; i++) {
    State.view[i] = []
    for (let j = 0; j < targetSize; j++) {
      let cell = document.createElement("cell")
      gameGrid.appendChild(cell)
      State.view[i][j] = cell
    }
  }
}

function isOpaque(pos) {
  return !(pos.hash() in State.maze)
}

function canSeePos(targetPos) {
  if (targetPos.equals(State.player_pos)) {
    return true
  }

  let x = State.player_pos.x
  let y = State.player_pos.y
  let targetX = targetPos.x
  let targetY = targetPos.y
  let dx = targetX - x
  let dy = targetY - y
  let stepX = Math.sign(dx)
  let stepY = Math.sign(dy)
  let absDx = Math.abs(dx)
  let absDy = Math.abs(dy)
  let error = absDx - absDy

  while (x !== targetX || y !== targetY) {
    let prevX = x
    let prevY = y
    let doubledError = error * 2
    let movedX = false
    let movedY = false

    if (doubledError > -absDy) {
      error -= absDy
      x += stepX
      movedX = true
    }

    if (doubledError < absDx) {
      error += absDx
      y += stepY
      movedY = true
    }

    if (movedX && movedY) {
      let sideA = new Pos(prevX + stepX, prevY)
      let sideB = new Pos(prevX, prevY + stepY)
      if (isOpaque(sideA) && isOpaque(sideB)) {
        return false
      }
    }

    let current = new Pos(x, y)
    if (isOpaque(current)) {
      return current.equals(targetPos)
    }
  }

  return true
}

function getVisibleHashesInView(viewSize) {
  let visible = new Set()

  for (let i = 0; i < viewSize; i++) {
    for (let j = 0; j < viewSize; j++) {
      let maze_x = State.player_pos.x - Math.floor(viewSize / 2) + i
      let maze_y = State.player_pos.y - Math.floor(viewSize / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      if (canSeePos(maze_pos)) {
        visible.add(maze_pos.hash())
      }
    }
  }

  return visible
}

function getAllHashesInView(viewSize) {
  let hashes = new Set()

  for (let i = 0; i < viewSize; i++) {
    for (let j = 0; j < viewSize; j++) {
      let maze_x = State.player_pos.x - Math.floor(viewSize / 2) + i
      let maze_y = State.player_pos.y - Math.floor(viewSize / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      hashes.add(maze_pos.hash())
    }
  }

  return hashes
}

function getConnectedVisiblePathHashes(visibleHashes, viewSize) {
  let connected = new Set()
  let visiblePath = new Set()

  for (let i = 0; i < viewSize; i++) {
    for (let j = 0; j < viewSize; j++) {
      let maze_x = State.player_pos.x - Math.floor(viewSize / 2) + i
      let maze_y = State.player_pos.y - Math.floor(viewSize / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      if (visibleHashes.has(maze_pos.hash()) && maze_pos.hash() in State.maze) {
        visiblePath.add(maze_pos.hash())
      }
    }
  }

  let playerHash = State.player_pos.hash()
  if (!visiblePath.has(playerHash)) {
    return connected
  }

  let queue = [State.player_pos.clone()]
  connected.add(playerHash)

  while (queue.length > 0) {
    let current = queue.shift()
    let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]

    for (let [dx, dy] of directions) {
      let next = new Pos(current.x + dx, current.y + dy)
      let nextHash = next.hash()

      if (!visiblePath.has(nextHash) || connected.has(nextHash)) {
        continue
      }

      connected.add(nextHash)
      queue.push(next)
    }
  }

  return connected
}

function getConnectedVisibleWallHashes(visibleHashes, connectedVisiblePath, viewSize) {
  let connectedWalls = new Set()
  let visibleWalls = new Set()

  for (let i = 0; i < viewSize; i++) {
    for (let j = 0; j < viewSize; j++) {
      let maze_x = State.player_pos.x - Math.floor(viewSize / 2) + i
      let maze_y = State.player_pos.y - Math.floor(viewSize / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      let mazeHash = maze_pos.hash()
      if (visibleHashes.has(mazeHash) && !(mazeHash in State.maze)) {
        visibleWalls.add(mazeHash)
      }
    }
  }

  let queue = []
  for (let pathHash of connectedVisiblePath) {
    let [x, y] = pathHash.split(",").map(Number)
    let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]

    for (let [dx, dy] of directions) {
      let neighborHash = new Pos(x + dx, y + dy).hash()
      if (visibleWalls.has(neighborHash) && !connectedWalls.has(neighborHash)) {
        connectedWalls.add(neighborHash)
        queue.push(new Pos(x + dx, y + dy))
      }
    }
  }

  while (queue.length > 0) {
    let current = queue.shift()
    let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]

    for (let [dx, dy] of directions) {
      let next = new Pos(current.x + dx, current.y + dy)
      let nextHash = next.hash()

      if (!visibleWalls.has(nextHash) || connectedWalls.has(nextHash)) {
        continue
      }

      connectedWalls.add(nextHash)
      queue.push(next)
    }
  }

  return connectedWalls
}

function syncMobileItemButtons() {
  let controls = document.querySelector("#mobile-item-controls")
  if (controls === null) {
    return
  }

  let enabledItems = []
  if (State.teleporterUnlocked) {
    enabledItems.push("teleporter")
  }
  if (State.drillUnlocked) {
    enabledItems.push("drill")
  }
  if (State.recallUnlocked) {
    enabledItems.push("recall")
  }

  let hasSameButtons = controls.children.length === enabledItems.length
  if (hasSameButtons) {
    for (let i = 0; i < enabledItems.length; i++) {
      let child = controls.children[i]
      if (!(child instanceof HTMLButtonElement) || child.dataset.item !== enabledItems[i]) {
        hasSameButtons = false
        break
      }
    }
  }

  if (hasSameButtons) {
    return
  }

  controls.replaceChildren()
  for (let item of enabledItems) {
    let button = document.createElement("button")
    button.type = "button"
    button.dataset.item = item
    button.setAttribute("aria-label", `use ${item}`)
    controls.appendChild(button)
  }
}

export function updateRender() {
  let playerHash = State.player_pos.hash()
  let isOnHomeCell = (playerHash in State.maze) && State.maze[playerHash] === CellType.HOME
  let isOnSafetyCell = (playerHash in State.maze) && State.maze[playerHash] === CellType.SAFETY
  let isOnShopCell = (playerHash in State.maze) && State.maze[playerHash] === CellType.SHOP
  let isMobile = window.matchMedia("(hover: none) and (pointer: coarse)").matches
  let targetViewSize = Config.view_size

  if (isOnHomeCell) {
    targetViewSize = (Config.view_size * 2) - 1
  } else if (isOnSafetyCell && State.jokerSafetyViewUnlocked) {
    targetViewSize = (Config.view_size * 2) - 1
  }

  if (targetViewSize % 2 === 0) {
    targetViewSize += 1
  }

  ensureViewGridSize(targetViewSize)
  let viewSize = getCurrentViewSize()

  let gameGrid = document.querySelector("#game-grid")
  if (gameGrid !== null) {
    gameGrid.style.setProperty("--view-scale", isOnHomeCell ? String(1 / 1.5) : "1")
    let gridMinSize = Math.min(gameGrid.clientWidth, gameGrid.clientHeight)
    let warningMaxFill = Math.max(0, Math.floor(gridMinSize / 2) - 12)

    if (State.hazardActive) {
      gameGrid.setAttribute("data-warning-active", "true")
      gameGrid.removeAttribute("data-warning-clearing")
      gameGrid.style.setProperty("--warning-color", State.hazardColor)
      let warningProgress = Math.min(1, State.hazardElapsedMs / Math.max(1, Config.event_warning_duration_ms))
      gameGrid.style.setProperty("--warning-progress", String(warningProgress))
      gameGrid.style.setProperty("--warning-max-fill", `${warningMaxFill}px`)
    } else if (State.warningClearActive) {
      gameGrid.removeAttribute("data-warning-active")
      gameGrid.setAttribute("data-warning-clearing", "true")
      gameGrid.style.setProperty("--warning-color", State.warningClearColor)
      let clearProgress = Math.min(1, State.warningClearElapsedMs / Math.max(1, Config.event_warning_clear_duration_ms))
      let warningProgress = Math.max(0, State.warningClearStartProgress * (1 - clearProgress))
      gameGrid.style.setProperty("--warning-progress", String(warningProgress))
      gameGrid.style.setProperty("--warning-max-fill", `${warningMaxFill}px`)
    } else {
      gameGrid.removeAttribute("data-warning-active")
      gameGrid.removeAttribute("data-warning-clearing")
      gameGrid.style.removeProperty("--warning-color")
      gameGrid.style.removeProperty("--warning-progress")
      gameGrid.style.removeProperty("--warning-max-fill")
    }
  }

  let floorCounter = document.querySelector("#floor-counter")
  if (floorCounter !== null) {
    floorCounter.textContent = `floor: ${State.floor}`
  }

  let pauseRetry = document.querySelector("#pause-retry")
  if (pauseRetry !== null) {
    pauseRetry.textContent = isMobile ? "tap to resume" : "press space to resume"
  }

  let shopRetry = document.querySelector("#shop-retry")
  if (shopRetry !== null) {
    shopRetry.textContent = isMobile ? "tap outside to close" : "press space to close"
  }

  let moneyCounter = document.querySelector("#money-counter")
  if (moneyCounter !== null) {
    moneyCounter.textContent = `coins: ${State.coins}`
  }

  syncMobileItemButtons()

  let shopHint = document.querySelector("#shop-hint")
  if (shopHint !== null) {
    shopHint.textContent = isMobile ? "tap to open shop" : "press space to open shop"
    let shouldShow = isOnShopCell && !State.isPaused && !State.isShopOpen && !State.gameOver
    if (shouldShow) {
      shopHint.removeAttribute("hidden")
    } else {
      shopHint.setAttribute("hidden", "")
    }
  }

  let keyCounter = document.querySelector("#key-counter")
  if (keyCounter !== null) {
    keyCounter.replaceChildren()

    for (let [color, count] of Object.entries(State.keyInventory)) {
      for (let i = 0; i < count; i++) {
        let icon = document.createElement("span")
        icon.className = "inventory-key"
        icon.setAttribute("data-key-color", color)
        icon.style.setProperty("--key-color", color)
        keyCounter.appendChild(icon)
      }
    }
  }

  let buyTeleporter = document.querySelector("#buy-teleporter")
  if (buyTeleporter !== null) {
    if (State.teleporterUnlocked) {
      buyTeleporter.textContent = `teleporter: ${formatBindLabel(State.teleporterBindCode)} (click to remap)`
      buyTeleporter.removeAttribute("disabled")
    } else {
      buyTeleporter.textContent = `teleporter: ${Config.teleporter_unlock_cost}`
      if (State.coins < Config.teleporter_unlock_cost) {
        buyTeleporter.setAttribute("disabled", "")
      } else {
        buyTeleporter.removeAttribute("disabled")
      }
    }
  }

  let buyDrill = document.querySelector("#buy-drill")
  if (buyDrill !== null) {
    if (State.drillUnlocked) {
      buyDrill.textContent = `drill: ${formatBindLabel(State.drillBindCode)} (use cost ${Config.drill_use_cost}, click to remap)`
      buyDrill.removeAttribute("disabled")
    } else {
      buyDrill.textContent = `drill: ${Config.drill_unlock_cost}`
      if (State.coins < Config.drill_unlock_cost) {
        buyDrill.setAttribute("disabled", "")
      } else {
        buyDrill.removeAttribute("disabled")
      }
    }
  }

  let buyRecall = document.querySelector("#buy-recall")
  if (buyRecall !== null) {
    if (State.recallUnlocked) {
      buyRecall.textContent = `recall: ${formatBindLabel(State.recallBindCode)} (use cost ${Config.recall_use_cost}, click to remap)`
      buyRecall.removeAttribute("disabled")
    } else {
      buyRecall.textContent = `recall: ${Config.recall_unlock_cost}`
      if (State.coins < Config.recall_unlock_cost) {
        buyRecall.setAttribute("disabled", "")
      } else {
        buyRecall.removeAttribute("disabled")
      }
    }
  }

  let buyJokerSafetyView = document.querySelector("#buy-joker-safety-view")
  if (buyJokerSafetyView !== null) {
    if (State.jokerSafetyViewUnlocked) {
      buyJokerSafetyView.textContent = "peek (unlocked)"
      buyJokerSafetyView.setAttribute("disabled", "")
    } else {
      buyJokerSafetyView.textContent = `peek: ${Config.joker_safety_view_upgrade_cost}`
      if (State.coins < Config.joker_safety_view_upgrade_cost) {
        buyJokerSafetyView.setAttribute("disabled", "")
      } else {
        buyJokerSafetyView.removeAttribute("disabled")
      }
    }
  }

  let bindPrompt = document.querySelector("#bind-prompt")
  if (bindPrompt !== null) {
    if (State.bindCaptureItem === null) {
      bindPrompt.textContent = ""
    } else {
      bindPrompt.textContent = `press a key for ${State.bindCaptureItem} (esc to cancel)`
    }
  }

  let visibleHashes = isOnHomeCell ? getAllHashesInView(viewSize) : getVisibleHashesInView(viewSize)
  let connectedVisiblePath
  let connectedVisibleWalls

  if (isOnHomeCell) {
    connectedVisiblePath = new Set()
    connectedVisibleWalls = new Set()

    for (let hash of visibleHashes) {
      if (hash in State.maze) {
        connectedVisiblePath.add(hash)
      } else {
        connectedVisibleWalls.add(hash)
      }
    }
  } else {
    connectedVisiblePath = getConnectedVisiblePathHashes(visibleHashes, viewSize)
    connectedVisibleWalls = getConnectedVisibleWallHashes(visibleHashes, connectedVisiblePath, viewSize)
  }

  for (let i = 0; i < viewSize; i++) {
    for (let j = 0; j < viewSize; j++) {
      let cell = State.view[i][j]
      let maze_x = State.player_pos.x - Math.floor(viewSize / 2) + i
      let maze_y = State.player_pos.y - Math.floor(viewSize / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      let mazeHash = maze_pos.hash()

      cell.removeAttribute("data-key-color")
      cell.style.removeProperty("--key-color")
      cell.removeAttribute("data-home-color")
      cell.style.removeProperty("--home-color")
      cell.removeAttribute("data-safety-color")
      cell.style.removeProperty("--safety-color")
      cell.removeAttribute("data-player")
      cell.removeAttribute("data-player-wobble")
      cell.removeAttribute("data-teleporter-up")
      cell.removeAttribute("data-teleporter-down")

      if (!visibleHashes.has(mazeHash)) {
        cell.setAttribute("type", "hidden")
      } else if (!(mazeHash in State.maze)) {
        if (connectedVisibleWalls.has(mazeHash)) {
          cell.setAttribute("type", "wall")
        } else {
          cell.setAttribute("type", "hidden")
        }
      } else if (!connectedVisiblePath.has(mazeHash)) {
        cell.setAttribute("type", "hidden")
      } else if (State.maze[mazeHash] === CellType.END) {
        cell.setAttribute("type", "end")
      } else if (State.maze[mazeHash] === CellType.KEY) {
        cell.setAttribute("type", "key")
        if (mazeHash in State.keyColorByHash) {
          let keyColor = State.keyColorByHash[mazeHash]
          cell.setAttribute("data-key-color", keyColor)
          cell.style.setProperty("--key-color", keyColor)
        }
      } else if (State.maze[mazeHash] === CellType.COIN) {
        cell.setAttribute("type", "coin")
      } else if (State.maze[mazeHash] === CellType.SHOP) {
        cell.setAttribute("type", "shop")
      } else if (State.maze[mazeHash] === CellType.DOOR) {
        cell.setAttribute("type", "door")
        if (mazeHash in State.doorColorByHash) {
          let doorColor = State.doorColorByHash[mazeHash]
          cell.setAttribute("data-key-color", doorColor)
          cell.style.setProperty("--key-color", doorColor)
        }
      } else if (State.maze[mazeHash] === CellType.OPEN) {
        cell.setAttribute("type", "open")
      } else if (State.maze[mazeHash] === CellType.HOME) {
        cell.setAttribute("type", "home")
        if (mazeHash in State.homeColorByHash) {
          let homeColor = State.homeColorByHash[mazeHash]
          cell.setAttribute("data-home-color", homeColor)
          cell.style.setProperty("--home-color", homeColor)
        }
      } else if (State.maze[mazeHash] === CellType.SAFETY) {
        cell.setAttribute("type", "safety")
        if (mazeHash in State.safetyColorByHash) {
          let safetyColor = State.safetyColorByHash[mazeHash]
          cell.setAttribute("data-safety-color", safetyColor)
          cell.style.setProperty("--safety-color", safetyColor)
        }
      }

      if (maze_pos.equals(State.player_pos) && visibleHashes.has(mazeHash) && connectedVisiblePath.has(mazeHash)) {
        cell.setAttribute("data-player", "true")
        cell.setAttribute("data-player-wobble", String(State.playerMoveTick % 2))
      }

      if (State.teleporterUpHash !== null && mazeHash === State.teleporterUpHash) {
        cell.setAttribute("data-teleporter-up", "true")
      }

      if (State.teleporterDownHash !== null && mazeHash === State.teleporterDownHash) {
        cell.setAttribute("data-teleporter-down", "true")
      }
    }
  }
}
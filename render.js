import { Config } from "./config.js"
import { State } from "./state.js"
import { Pos } from "./pos.js"
import { CellType } from "./cell.js"

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

function getVisibleHashesInView() {
  let visible = new Set()

  for (let i = 0; i < Config.view_size; i++) {
    for (let j = 0; j < Config.view_size; j++) {
      let maze_x = State.player_pos.x - Math.floor(Config.view_size / 2) + i
      let maze_y = State.player_pos.y - Math.floor(Config.view_size / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      if (canSeePos(maze_pos)) {
        visible.add(maze_pos.hash())
      }
    }
  }

  return visible
}

function getConnectedVisiblePathHashes(visibleHashes) {
  let connected = new Set()
  let visiblePath = new Set()

  for (let i = 0; i < Config.view_size; i++) {
    for (let j = 0; j < Config.view_size; j++) {
      let maze_x = State.player_pos.x - Math.floor(Config.view_size / 2) + i
      let maze_y = State.player_pos.y - Math.floor(Config.view_size / 2) + j
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

function getConnectedVisibleWallHashes(visibleHashes, connectedVisiblePath) {
  let connectedWalls = new Set()
  let visibleWalls = new Set()

  for (let i = 0; i < Config.view_size; i++) {
    for (let j = 0; j < Config.view_size; j++) {
      let maze_x = State.player_pos.x - Math.floor(Config.view_size / 2) + i
      let maze_y = State.player_pos.y - Math.floor(Config.view_size / 2) + j
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

export function updateRender() {
  let floorCounter = document.querySelector("#floor-counter")
  if (floorCounter !== null) {
    floorCounter.textContent = `floor: ${State.floor}`
  }

  let keyCounter = document.querySelector("#key-counter")
  if (keyCounter !== null) {
    keyCounter.replaceChildren()

    for (let [color, count] of Object.entries(State.keyInventory)) {
      for (let i = 0; i < count; i++) {
        let icon = document.createElement("span")
        icon.className = "inventory-key"
        icon.setAttribute("data-key-color", color)
        keyCounter.appendChild(icon)
      }
    }
  }

  let visibleHashes = getVisibleHashesInView()
  let connectedVisiblePath = getConnectedVisiblePathHashes(visibleHashes)
  let connectedVisibleWalls = getConnectedVisibleWallHashes(visibleHashes, connectedVisiblePath)

  for (let i = 0; i < Config.view_size; i++) {
    for (let j = 0; j < Config.view_size; j++) {
      let cell = State.view[i][j]
      let maze_x = State.player_pos.x - Math.floor(Config.view_size / 2) + i
      let maze_y = State.player_pos.y - Math.floor(Config.view_size / 2) + j
      let maze_pos = new Pos(maze_x, maze_y)
      let mazeHash = maze_pos.hash()

      cell.removeAttribute("data-key-color")
      cell.removeAttribute("data-player")
      cell.removeAttribute("data-player-wobble")

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
          cell.setAttribute("data-key-color", State.keyColorByHash[mazeHash])
        }
      } else if (State.maze[mazeHash] === CellType.DOOR) {
        cell.setAttribute("type", "door")
        if (mazeHash in State.doorColorByHash) {
          cell.setAttribute("data-key-color", State.doorColorByHash[mazeHash])
        }
      } else if (State.maze[mazeHash] === CellType.OPEN) {
        cell.setAttribute("type", "open")
      }

      if (maze_pos.equals(State.player_pos) && visibleHashes.has(mazeHash) && connectedVisiblePath.has(mazeHash)) {
        cell.setAttribute("data-player", "true")
        cell.setAttribute("data-player-wobble", String(State.playerMoveTick % 2))
      }
    }
  }
}
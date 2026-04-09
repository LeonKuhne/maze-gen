import { Pos } from "./pos.js"
import { Config } from "./config.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"

const CARDINAL_DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const KEY_COLORS = ["red", "blue", "gold"]

function isCarvedCell(pos, candidatePos = null) {
  if (candidatePos !== null && pos.x === candidatePos.x && pos.y === candidatePos.y) {
    return true
  }

  return pos.hash() in State.maze
}

function creates2x2OpenSpace(candidatePos) {
  for (let offsetX = -1; offsetX <= 0; offsetX++) {
    for (let offsetY = -1; offsetY <= 0; offsetY++) {
      let topLeft = new Pos(candidatePos.x + offsetX, candidatePos.y + offsetY)
      let topRight = new Pos(topLeft.x + 1, topLeft.y)
      let bottomLeft = new Pos(topLeft.x, topLeft.y + 1)
      let bottomRight = new Pos(topLeft.x + 1, topLeft.y + 1)

      if (
        isCarvedCell(topLeft, candidatePos) &&
        isCarvedCell(topRight, candidatePos) &&
        isCarvedCell(bottomLeft, candidatePos) &&
        isCarvedCell(bottomRight, candidatePos)
      ) {
        return true
      }
    }
  }

  return false
}

function countCarvedNeighbors(pos) {
  let carvedNeighbors = 0

  for (let [dx, dy] of CARDINAL_DIRECTIONS) {
    let neighbor = new Pos(pos.x + dx, pos.y + dy)
    if (neighbor.hash() in State.maze) {
      carvedNeighbors++
    }
  }

  return carvedNeighbors
}

function getRandomForkInterval() {
  let forkMin = Math.max(1, Math.floor(Config.fork_min))
  let forkMax = Math.max(forkMin, Math.floor(Config.fork_max))
  return Math.floor(Math.random() * (forkMax - forkMin + 1)) + forkMin
}

function getNextFrontierPos(stack, shouldFork) {
  if (shouldFork && stack.length > 1) {
    let randomIndex = Math.floor(Math.random() * (stack.length - 1))
    return stack.splice(randomIndex, 1)[0]
  }

  return stack.pop()
}

function parseHash(hash) {
  let [x, y] = hash.split(",").map(Number)
  return new Pos(x, y)
}

function countTraversableNeighbors(pos) {
  let traversableCount = 0

  for (let [dx, dy] of CARDINAL_DIRECTIONS) {
    let neighbor = new Pos(pos.x + dx, pos.y + dy)
    let neighborHash = neighbor.hash()
    if (neighborHash in State.maze) {
      traversableCount++
    }
  }

  return traversableCount
}

function getDeadEndHashes(startHash, endHash) {
  let deadEnds = []

  for (let hash in State.maze) {
    if (hash === startHash || hash === endHash) {
      continue
    }

    if (State.maze[hash] !== CellType.OPEN) {
      continue
    }

    let pos = parseHash(hash)
    if (countTraversableNeighbors(pos) === 1) {
      deadEnds.push(hash)
    }
  }

  return deadEnds
}

function getPathHashes(startPos, targetHash) {
  let queue = [startPos.clone()]
  let visited = new Set([startPos.hash()])
  let parentByHash = {}

  while (queue.length > 0) {
    let current = queue.shift()
    let currentHash = current.hash()

    if (currentHash === targetHash) {
      break
    }

    for (let [dx, dy] of CARDINAL_DIRECTIONS) {
      let next = new Pos(current.x + dx, current.y + dy)
      let nextHash = next.hash()

      if (!(nextHash in State.maze) || visited.has(nextHash)) {
        continue
      }

      visited.add(nextHash)
      parentByHash[nextHash] = currentHash
      queue.push(next)
    }
  }

  let pathHashes = new Set()
  if (!visited.has(targetHash)) {
    return pathHashes
  }

  let currentHash = targetHash
  while (currentHash !== undefined) {
    pathHashes.add(currentHash)
    currentHash = parentByHash[currentHash]
  }

  return pathHashes
}

function getPathToTarget(startPos, targetHash) {
  let queue = [startPos.clone()]
  let visited = new Set([startPos.hash()])
  let parentByHash = {}

  while (queue.length > 0) {
    let current = queue.shift()
    let currentHash = current.hash()

    if (currentHash === targetHash) {
      break
    }

    for (let [dx, dy] of CARDINAL_DIRECTIONS) {
      let next = new Pos(current.x + dx, current.y + dy)
      let nextHash = next.hash()

      if (!(nextHash in State.maze) || visited.has(nextHash)) {
        continue
      }

      visited.add(nextHash)
      parentByHash[nextHash] = currentHash
      queue.push(next)
    }
  }

  if (!visited.has(targetHash)) {
    return []
  }

  let path = []
  let currentHash = targetHash
  while (currentHash !== undefined) {
    path.push(currentHash)
    currentHash = parentByHash[currentHash]
  }

  path.reverse()
  return path
}

function getTraversableNeighborHashes(hash) {
  let pos = parseHash(hash)
  let neighbors = []

  for (let [dx, dy] of CARDINAL_DIRECTIONS) {
    let neighborHash = new Pos(pos.x + dx, pos.y + dy).hash()
    if (neighborHash in State.maze) {
      neighbors.push(neighborHash)
    }
  }

  return neighbors
}

function getDeadEndAttachmentIndex(deadEndHash, pathIndexByHash) {
  let currentHash = deadEndHash
  let previousHash = null

  while (!(currentHash in pathIndexByHash)) {
    let nextOptions = getTraversableNeighborHashes(currentHash).filter((hash) => hash !== previousHash)
    if (nextOptions.length === 0) {
      return -1
    }

    previousHash = currentHash
    currentHash = nextOptions[0]
  }

  return pathIndexByHash[currentHash]
}

function placeKeysAndDoors(endHash) {
  let startHash = State.player_pos.hash()
  let deadEndHashes = getDeadEndHashes(startHash, endHash)
  if (deadEndHashes.length === 0) {
    return
  }

  let startToEndPath = getPathToTarget(State.player_pos, endHash)
  if (startToEndPath.length < 3) {
    return
  }

  let pathIndexByHash = {}
  for (let i = 0; i < startToEndPath.length; i++) {
    pathIndexByHash[startToEndPath[i]] = i
  }

  let doorIndexes = []
  for (let i = 1; i < startToEndPath.length - 1; i++) {
    let hash = startToEndPath[i]
    if (State.maze[hash] === CellType.OPEN) {
      doorIndexes.push(i)
    }
  }

  let keyedDeadEnds = deadEndHashes
    .map((hash) => {
      return {
        hash,
        attachmentIndex: getDeadEndAttachmentIndex(hash, pathIndexByHash)
      }
    })
    .filter((entry) => entry.attachmentIndex >= 0)

  keyedDeadEnds.sort((a, b) => a.attachmentIndex - b.attachmentIndex)

  let availableDoorIndexes = [...doorIndexes]
  let pairs = []

  for (let deadEnd of keyedDeadEnds) {
    let doorSlot = availableDoorIndexes.findIndex((index) => index > deadEnd.attachmentIndex)
    if (doorSlot === -1) {
      continue
    }

    let [doorIndex] = availableDoorIndexes.splice(doorSlot, 1)
    pairs.push({
      keyHash: deadEnd.hash,
      doorHash: startToEndPath[doorIndex]
    })
  }

  for (let i = pairs.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }

  for (let i = 0; i < pairs.length; i++) {
    let keyColor = KEY_COLORS[i % KEY_COLORS.length]
    let { keyHash, doorHash } = pairs[i]

    State.maze[keyHash] = CellType.KEY
    State.keyColorByHash[keyHash] = keyColor

    State.maze[doorHash] = CellType.DOOR
    State.doorColorByHash[doorHash] = keyColor

    if (!(keyColor in State.keyInventory)) {
      State.keyInventory[keyColor] = 0
    }
  }
}

function getOpenHashes() {
  let openHashes = []
  for (let hash in State.maze) {
    if (State.maze[hash] === CellType.OPEN) {
      openHashes.push(hash)
    }
  }

  return openHashes
}

function getFirstOpenPathHash(pathHashes, used = new Set()) {
  for (let hash of pathHashes) {
    if (used.has(hash)) {
      continue
    }

    if (State.maze[hash] === CellType.OPEN) {
      return hash
    }
  }

  return null
}

function getLastOpenPathHash(pathHashes, used = new Set()) {
  for (let i = pathHashes.length - 1; i >= 0; i--) {
    let hash = pathHashes[i]
    if (used.has(hash)) {
      continue
    }

    if (State.maze[hash] === CellType.OPEN) {
      return hash
    }
  }

  return null
}

function getOpenHashAfterPathIndex(pathHashes, startIndex, used = new Set()) {
  for (let i = Math.max(0, startIndex); i < pathHashes.length; i++) {
    let hash = pathHashes[i]
    if (used.has(hash)) {
      continue
    }

    if (State.maze[hash] === CellType.OPEN) {
      return hash
    }
  }

  return null
}

function getOpenHashBeforePathIndex(pathHashes, startIndex, used = new Set()) {
  for (let i = Math.min(pathHashes.length - 1, startIndex); i >= 0; i--) {
    let hash = pathHashes[i]
    if (used.has(hash)) {
      continue
    }

    if (State.maze[hash] === CellType.OPEN) {
      return hash
    }
  }

  return null
}

function placeWeaponsAndEnemies(endHash) {
  let startToEndPath = getPathToTarget(State.player_pos, endHash)
  if (startToEndPath.length === 0) {
    return
  }

  let usedHashes = new Set([State.player_pos.hash(), endHash])

  let swordHash = getFirstOpenPathHash(startToEndPath, usedHashes)
  if (swordHash === null) {
    let openHashes = getOpenHashes().filter((hash) => !usedHashes.has(hash))
    swordHash = openHashes.length > 0 ? openHashes[0] : null
  }

  if (swordHash !== null) {
    State.maze[swordHash] = CellType.SWORD
    usedHashes.add(swordHash)
  }

  let swordIndex = swordHash === null ? 1 : startToEndPath.indexOf(swordHash)

  let gunHash = getOpenHashAfterPathIndex(startToEndPath, swordIndex + 1, usedHashes)
  if (gunHash === null) {
    let openHashes = getOpenHashes().filter((hash) => !usedHashes.has(hash))
    gunHash = openHashes.length > 0 ? openHashes[openHashes.length - 1] : null
  }

  if (gunHash !== null) {
    State.maze[gunHash] = CellType.GUN
    usedHashes.add(gunHash)
  }

  let gunIndex = gunHash === null ? startToEndPath.length - 2 : startToEndPath.indexOf(gunHash)

  let meleeHash = getOpenHashAfterPathIndex(startToEndPath, swordIndex + 1, usedHashes)
  if (meleeHash !== null) {
    State.maze[meleeHash] = CellType.ENEMY_MELEE
    usedHashes.add(meleeHash)
  }

  let rangedHash = getOpenHashAfterPathIndex(startToEndPath, gunIndex + 1, usedHashes)

  if (rangedHash !== null) {
    State.maze[rangedHash] = CellType.ENEMY_RANGED
    usedHashes.add(rangedHash)
  }
}

export function generateMaze() {
  for (let timeoutId of Object.values(State.enemyAttackTimeoutByHash)) {
    clearTimeout(timeoutId)
  }

  if (State.enemyBulletTimerId !== null) {
    clearInterval(State.enemyBulletTimerId)
    State.enemyBulletTimerId = null
  }

  State.enemyAttackTimeoutByHash = {}
  State.enemyActionByHash = {}
  State.enemyBulletHashes = new Set()
  State.playerActionType = ""
  State.maze = {}
  State.weaponInventory = { sword: false, gun: false }
  State.keyInventory = {}
  State.keyColorByHash = {}
  State.doorColorByHash = {}

  let maze_cells = Math.max(1, Math.floor(Config.maze_size))
  let num_cells = 0
  let nextForkAt = getRandomForkInterval()
  let last_open_pos = null
  let stack = [State.player_pos.clone()]

  while (num_cells < maze_cells && stack.length > 0) {
    let shouldFork = num_cells > 0 && num_cells >= nextForkAt && stack.length > 1
    let pos = getNextFrontierPos(stack, shouldFork)

    if (shouldFork) {
      nextForkAt += getRandomForkInterval()
    }

    if (pos.hash() in State.maze) {
      continue
    }

    if (num_cells > 0 && countCarvedNeighbors(pos) !== 1) {
      continue
    }

    if (num_cells > 0 && creates2x2OpenSpace(pos)) {
      continue
    }

    State.maze[pos.hash()] = CellType.OPEN
    last_open_pos = pos
    num_cells++

    let directions = [...CARDINAL_DIRECTIONS]
    directions.sort(() => Math.random() - 0.5)

    for (let [dx, dy] of directions) {
      let new_pos = new Pos(pos.x + dx, pos.y + dy)
      if (!(new_pos.hash() in State.maze)) {
        stack.push(new_pos)
      }
    }
  }

  if (last_open_pos !== null) {
    let endHash = last_open_pos.hash()
    State.maze[endHash] = CellType.END
    placeKeysAndDoors(endHash)
    placeWeaponsAndEnemies(endHash)
  }
}

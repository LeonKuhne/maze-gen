import { Pos } from "./pos.js"
import { Config } from "./config.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"

const CARDINAL_DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const COLOR_COUNT = 64

function generateKeyColor(index) {
  let hue = Math.floor(((index * 137.508) % COLOR_COUNT) * (360 / COLOR_COUNT))
  return `hsl(${hue} 78% 54%)`
}

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
  let queue = [deadEndHash]
  let visited = new Set([deadEndHash])
  let bestAttachmentIndex = Number.POSITIVE_INFINITY

  while (queue.length > 0) {
    let currentHash = queue.shift()

    if (currentHash in pathIndexByHash) {
      bestAttachmentIndex = Math.min(bestAttachmentIndex, pathIndexByHash[currentHash])
      continue
    }

    let neighbors = getTraversableNeighborHashes(currentHash)
    for (let neighborHash of neighbors) {
      if (visited.has(neighborHash)) {
        continue
      }

      visited.add(neighborHash)
      queue.push(neighborHash)
    }
  }

  if (!Number.isFinite(bestAttachmentIndex)) {
    return -1
  }

  return bestAttachmentIndex
}

function getMazeCellTargetForFloor() {
  let baseSize = Math.max(1, Math.floor(Config.maze_size))
  let growthPerFloor = Math.max(0, Math.floor(Config.maze_size_growth_per_floor))
  let floorDepth = Math.max(1, Math.floor(State.floor))
  let target = baseSize + ((floorDepth - 1) * growthPerFloor)
  let maxSize = Math.max(baseSize, Math.floor(Config.maze_size_max))
  return Math.min(target, maxSize)
}

function selectSpacedDoorIndexes(doorIndexes) {
  if (doorIndexes.length === 0) {
    return []
  }

  let floorDepth = Math.max(1, Math.floor(State.floor))
  let baseDoorCount = Math.max(1, Math.floor(Config.door_count_base))
  let growthPerFloor = Math.max(0, Number(Config.door_count_growth_per_floor) || 0)
  let maxDoorCount = Math.max(baseDoorCount, Math.floor(Config.door_count_max))
  let targetDoorCount = Math.min(maxDoorCount, Math.max(1, Math.floor(baseDoorCount + ((floorDepth - 1) * growthPerFloor))))

  if (doorIndexes.length <= targetDoorCount) {
    return [...doorIndexes]
  }

  if (targetDoorCount === 1) {
    return [doorIndexes[Math.floor(doorIndexes.length / 2)]]
  }

  let selected = []
  for (let i = 0; i < targetDoorCount; i++) {
    let position = (i * (doorIndexes.length - 1)) / (targetDoorCount - 1)
    let candidateIndex = doorIndexes[Math.round(position)]

    if (selected.length === 0 || selected[selected.length - 1] !== candidateIndex) {
      selected.push(candidateIndex)
    }
  }

  if (selected.length < targetDoorCount) {
    for (let doorIndex of doorIndexes) {
      if (selected.includes(doorIndex)) {
        continue
      }

      selected.push(doorIndex)
      if (selected.length >= targetDoorCount) {
        break
      }
    }
  }

  selected.sort((a, b) => a - b)
  return selected
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

  let minDoorGap = Math.max(2, Math.floor(Config.door_min_path_gap))
  let spacedDoorIndexes = []
  for (let doorIndex of doorIndexes) {
    if (spacedDoorIndexes.length === 0) {
      spacedDoorIndexes.push(doorIndex)
      continue
    }

    let lastDoorIndex = spacedDoorIndexes[spacedDoorIndexes.length - 1]
    if (doorIndex - lastDoorIndex >= minDoorGap) {
      spacedDoorIndexes.push(doorIndex)
    }
  }

  let selectedDoorIndexes = selectSpacedDoorIndexes(spacedDoorIndexes)

  let keyedDeadEnds = deadEndHashes
    .map((hash) => {
      return {
        hash,
        attachmentIndex: getDeadEndAttachmentIndex(hash, pathIndexByHash)
      }
    })
    .filter((entry) => entry.attachmentIndex >= 0)

  keyedDeadEnds.sort((a, b) => a.attachmentIndex - b.attachmentIndex)

  let availableDeadEnds = [...keyedDeadEnds]
  let pairs = []

  for (let doorIndex of selectedDoorIndexes) {
    let eligibleDeadEndIndexes = []

    for (let i = 0; i < availableDeadEnds.length; i++) {
      if (availableDeadEnds[i].attachmentIndex < doorIndex) {
        eligibleDeadEndIndexes.push(i)
      }
    }

    if (eligibleDeadEndIndexes.length === 0) {
      continue
    }

    let randomCandidateSlot = Math.floor(Math.random() * eligibleDeadEndIndexes.length)
    let deadEndSlot = eligibleDeadEndIndexes[randomCandidateSlot]
    let [deadEnd] = availableDeadEnds.splice(deadEndSlot, 1)

    pairs.push({
      keyHash: deadEnd.hash,
      keyAttachmentIndex: deadEnd.attachmentIndex,
      doorHash: startToEndPath[doorIndex],
      doorIndex
    })
  }

  if (pairs.length === 0) {
    return
  }

  for (let i = pairs.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1))
    ;[pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }

  let colorByGroup = []
  let groupCount = Math.max(1, Math.ceil(pairs.length / 2))
  for (let i = 0; i < groupCount; i++) {
    colorByGroup.push(generateKeyColor(i))
  }

  let groupForPair = pairs.map(() => Math.floor(Math.random() * groupCount))

  let hasGroup = new Set(groupForPair)
  for (let i = 0; i < groupCount; i++) {
    if (hasGroup.has(i)) {
      continue
    }

    let randomPairIndex = Math.floor(Math.random() * pairs.length)
    groupForPair[randomPairIndex] = i
    hasGroup.add(i)
  }

  let representativePairByGroup = {}
  let doorHashesByGroup = {}

  for (let i = 0; i < pairs.length; i++) {
    let groupIndex = groupForPair[i]
    let pair = pairs[i]
    let { doorHash } = pair

    if (!(groupIndex in representativePairByGroup)) {
      representativePairByGroup[groupIndex] = pair
    } else if (pair.keyAttachmentIndex < representativePairByGroup[groupIndex].keyAttachmentIndex) {
      representativePairByGroup[groupIndex] = pair
    }

    if (!(groupIndex in doorHashesByGroup)) {
      doorHashesByGroup[groupIndex] = []
    }
    doorHashesByGroup[groupIndex].push(doorHash)
  }

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
    let keyColor = colorByGroup[groupIndex]
    let representativePair = representativePairByGroup[groupIndex]
    let keyHash = representativePair?.keyHash
    let doorHashes = doorHashesByGroup[groupIndex] ?? []

    if (keyHash !== undefined) {
      State.maze[keyHash] = CellType.KEY
      State.keyColorByHash[keyHash] = keyColor
    }

    for (let doorHash of doorHashes) {
      State.maze[doorHash] = CellType.DOOR
      State.doorColorByHash[doorHash] = keyColor
    }

    if (!(keyColor in State.keyInventory)) {
      State.keyInventory[keyColor] = 0
    }
  }
}

function getHomeColor(index) {
  return "#fff"
}

function getSafetyColor(index) {
  return generateKeyColor(index)
}

function placeHomeTile(endHash) {
  let startHash = State.player_pos.hash()
  let candidates = []

  for (let hash in State.maze) {
    if (hash === startHash || hash === endHash) {
      continue
    }

    if (State.maze[hash] !== CellType.OPEN) {
      continue
    }

    candidates.push(hash)
  }

  if (candidates.length === 0) {
    return
  }

  candidates.sort(() => Math.random() - 0.5)

  let hash = candidates[0]
  State.maze[hash] = CellType.HOME
  State.homeColorByHash[hash] = getHomeColor(0)
  State.homeHash = hash
}

function placeSafetyTiles(endHash) {
  let startHash = State.player_pos.hash()
  let candidates = []

  for (let hash in State.maze) {
    if (hash === startHash || hash === endHash) {
      continue
    }

    if (State.maze[hash] !== CellType.OPEN) {
      continue
    }

    candidates.push(hash)
  }

  if (candidates.length === 0) {
    return
  }

  candidates.sort(() => Math.random() - 0.5)

  let minCount = Math.max(1, Math.floor(Config.safety_tile_min))
  let maxCount = Math.max(minCount, Math.floor(Config.safety_tile_max))
  let targetCount = Math.min(candidates.length, Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount)

  for (let i = 0; i < targetCount; i++) {
    let hash = candidates[i]
    State.maze[hash] = CellType.SAFETY
    State.safetyColorByHash[hash] = getSafetyColor(i)
  }
}

function placeCoins(endHash) {
  let startHash = State.player_pos.hash()
  let candidates = []

  for (let hash in State.maze) {
    if (hash === startHash || hash === endHash) {
      continue
    }

    if (State.maze[hash] !== CellType.OPEN) {
      continue
    }

    candidates.push(hash)
  }

  if (candidates.length === 0) {
    return
  }

  candidates.sort(() => Math.random() - 0.5)

  let minCount = Math.max(0, Math.floor(Config.coin_min))
  let maxCount = Math.max(minCount, Math.floor(Config.coin_max))
  let targetCount = Math.min(candidates.length, Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount)

  for (let i = 0; i < targetCount; i++) {
    let hash = candidates[i]
    State.maze[hash] = CellType.COIN
  }
}

function placeShopTile(endHash) {
  let startHash = State.player_pos.hash()
  let candidates = []

  for (let hash in State.maze) {
    if (hash === startHash || hash === endHash) {
      continue
    }

    if (State.maze[hash] !== CellType.OPEN) {
      continue
    }

    candidates.push(hash)
  }

  if (candidates.length === 0) {
    return
  }

  candidates.sort(() => Math.random() - 0.5)
  State.maze[candidates[0]] = CellType.SHOP
}

export function generateMaze() {
  State.maze = {}
  State.keyInventory = {}
  State.keyPickupOrder = []
  State.keyColorByHash = {}
  State.doorColorByHash = {}
  State.homeColorByHash = {}
  State.homeHash = null
  State.safetyColorByHash = {}
  State.teleporterUpHash = null
  State.teleporterDownHash = null
  State.teleporterPlacementTarget = "up"

  let maze_cells = getMazeCellTargetForFloor()
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

    let carvedNeighborCount = countCarvedNeighbors(pos)
    if (num_cells > 0) {
      let reconnectChance = Math.max(0, Math.min(1, Number(Config.path_reconnect_chance) || 0))
      let shouldReconnect = carvedNeighborCount === 2 && Math.random() < reconnectChance
      if (carvedNeighborCount !== 1 && !shouldReconnect) {
        continue
      }
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
    placeHomeTile(endHash)
    placeShopTile(endHash)
    placeSafetyTiles(endHash)
    placeCoins(endHash)
  }
}

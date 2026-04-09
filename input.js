import { updateRender } from "./render.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"
import { generateMaze } from "./maze.js"
import { Pos } from "./pos.js"

const CARDINAL_DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const MELEE_ATTACK_DELAY_MS = 550
const RANGED_ATTACK_DELAY_MS = 700
const ENEMY_ATTACK_RESOLVE_DELAY_MS = 140
const ENEMY_BULLET_STEP_MS = 70

function parseHash(hash) {
  let [x, y] = hash.split(",").map(Number)
  return new Pos(x, y)
}

function clearEnemyAttackTimer(hash) {
  let timeoutId = State.enemyAttackTimeoutByHash[hash]
  if (timeoutId !== undefined) {
    clearTimeout(timeoutId)
    delete State.enemyAttackTimeoutByHash[hash]
  }
}

function clearEnemyBulletAnimation() {
  if (State.enemyBulletTimerId !== null) {
    clearInterval(State.enemyBulletTimerId)
    State.enemyBulletTimerId = null
  }

  State.enemyBulletHashes = new Set()
}

function triggerPlayerAction(type) {
  State.playerActionType = type
  State.playerActionTick++
}

function triggerEnemyAction(hash, type) {
  let previous = State.enemyActionByHash[hash]
  let nextTick = previous === undefined ? 1 : previous.tick + 1
  State.enemyActionByHash[hash] = { type, tick: nextTick }
}

function isMeleeThreateningPlayer(enemyPos) {
  let dx = Math.abs(enemyPos.x - State.player_pos.x)
  let dy = Math.abs(enemyPos.y - State.player_pos.y)
  return dx + dy === 1
}

function hasOrthogonalLineOfSight(enemyPos, targetPos) {
  if (enemyPos.x !== targetPos.x && enemyPos.y !== targetPos.y) {
    return false
  }

  if (enemyPos.x === targetPos.x) {
    let step = Math.sign(targetPos.y - enemyPos.y)
    for (let y = enemyPos.y + step; y !== targetPos.y; y += step) {
      if (!(new Pos(enemyPos.x, y).hash() in State.maze)) {
        return false
      }
    }
    return true
  }

  let step = Math.sign(targetPos.x - enemyPos.x)
  for (let x = enemyPos.x + step; x !== targetPos.x; x += step) {
    if (!(new Pos(x, enemyPos.y).hash() in State.maze)) {
      return false
    }
  }

  return true
}

function buildBulletPath(enemyPos, targetPos) {
  let path = []

  if (enemyPos.x === targetPos.x) {
    let step = Math.sign(targetPos.y - enemyPos.y)
    for (let y = enemyPos.y + step; y !== targetPos.y + step; y += step) {
      path.push(new Pos(enemyPos.x, y).hash())
    }
    return path
  }

  if (enemyPos.y === targetPos.y) {
    let step = Math.sign(targetPos.x - enemyPos.x)
    for (let x = enemyPos.x + step; x !== targetPos.x + step; x += step) {
      path.push(new Pos(x, enemyPos.y).hash())
    }
  }

  return path
}

function animateEnemyBullet(enemyPos, targetPos) {
  clearEnemyBulletAnimation()

  let path = buildBulletPath(enemyPos, targetPos)
  if (path.length === 0) {
    return
  }

  let stepIndex = 0
  State.enemyBulletTimerId = setInterval(() => {
    if (stepIndex >= path.length) {
      clearEnemyBulletAnimation()
      updateRender()
      evaluateEnemyAttacks()
      return
    }

    let bulletHash = path[stepIndex]
    State.enemyBulletHashes = new Set([bulletHash])
    updateRender()

    if (bulletHash === State.player_pos.hash()) {
      clearEnemyBulletAnimation()
      updateRender()
      resetCurrentFloor()
      return
    }

    stepIndex++
  }, ENEMY_BULLET_STEP_MS)
}

function isRangedThreateningPlayer(enemyPos) {
  return hasOrthogonalLineOfSight(enemyPos, State.player_pos)
}

function resetCurrentFloor() {
  State.player_pos = new Pos(0, 0)
  State.playerMoveTick++
  generateMaze()
  clearEnemyBulletAnimation()
  updateRender()
  evaluateEnemyAttacks()
}

function scheduleEnemyAttack(hash, delayMs) {
  if (hash in State.enemyAttackTimeoutByHash) {
    return
  }

  State.enemyAttackTimeoutByHash[hash] = setTimeout(() => {
    delete State.enemyAttackTimeoutByHash[hash]

    if (!(hash in State.maze)) {
      return
    }

    let pos = parseHash(hash)
    let type = State.maze[hash]

    if (type === CellType.ENEMY_MELEE && isMeleeThreateningPlayer(pos)) {
      triggerEnemyAction(hash, "swing")
      updateRender()
      setTimeout(() => {
        if (!(hash in State.maze) || State.maze[hash] !== CellType.ENEMY_MELEE) {
          return
        }

        let enemyPos = parseHash(hash)
        if (isMeleeThreateningPlayer(enemyPos)) {
          resetCurrentFloor()
        }
      }, ENEMY_ATTACK_RESOLVE_DELAY_MS)
      return
    }

    if (type === CellType.ENEMY_RANGED && isRangedThreateningPlayer(pos)) {
      triggerEnemyAction(hash, "shoot")
      updateRender()
      setTimeout(() => {
        if (!(hash in State.maze) || State.maze[hash] !== CellType.ENEMY_RANGED) {
          return
        }

        let enemyPos = parseHash(hash)
        if (isRangedThreateningPlayer(enemyPos)) {
          animateEnemyBullet(enemyPos, State.player_pos.clone())
        }
      }, ENEMY_ATTACK_RESOLVE_DELAY_MS)
      return
    }
  }, delayMs)
}

export function evaluateEnemyAttacks() {
  if (State.enemyBulletTimerId !== null) {
    return
  }

  for (let hash in State.maze) {
    let type = State.maze[hash]
    if (type !== CellType.ENEMY_MELEE && type !== CellType.ENEMY_RANGED) {
      clearEnemyAttackTimer(hash)
      delete State.enemyActionByHash[hash]
      continue
    }

    let pos = parseHash(hash)
    if (type === CellType.ENEMY_MELEE) {
      if (isMeleeThreateningPlayer(pos)) {
        scheduleEnemyAttack(hash, MELEE_ATTACK_DELAY_MS)
      } else {
        clearEnemyAttackTimer(hash)
      }
      continue
    }

    if (isRangedThreateningPlayer(pos)) {
      scheduleEnemyAttack(hash, RANGED_ATTACK_DELAY_MS)
    } else {
      clearEnemyAttackTimer(hash)
    }
  }
}

function trySwordSwing() {
  if (!State.weaponInventory.sword) {
    return { attempted: false, hit: false }
  }

  let hit = false
  for (let [dx, dy] of CARDINAL_DIRECTIONS) {
    let target = new Pos(State.player_pos.x + dx, State.player_pos.y + dy)
    let hash = target.hash()
    if (!(hash in State.maze)) {
      continue
    }

    if (State.maze[hash] === CellType.ENEMY_MELEE) {
      State.maze[hash] = CellType.OPEN
      clearEnemyAttackTimer(hash)
      delete State.enemyActionByHash[hash]
      hit = true
    }
  }

  return { attempted: true, hit }
}

function tryGunShot() {
  if (!State.weaponInventory.gun) {
    return { attempted: false, hit: false }
  }

  for (let [dx, dy] of CARDINAL_DIRECTIONS) {
    let x = State.player_pos.x + dx
    let y = State.player_pos.y + dy

    while (true) {
      let hash = new Pos(x, y).hash()
      if (!(hash in State.maze)) {
        break
      }

      if (State.maze[hash] === CellType.ENEMY_RANGED) {
        State.maze[hash] = CellType.OPEN
        clearEnemyAttackTimer(hash)
        delete State.enemyActionByHash[hash]
        return { attempted: true, hit: true }
      }

      x += dx
      y += dy
    }
  }

  return { attempted: true, hit: false }
}

export function useWeaponAction() {
  let changed = false
  let acted = false

  let swordResult = trySwordSwing()
  if (swordResult.attempted) {
    triggerPlayerAction("swing")
    acted = true
  }
  changed = swordResult.hit

  if (!changed) {
    let gunResult = tryGunShot()
    if (gunResult.attempted) {
      triggerPlayerAction("shoot")
      acted = true
    }

    changed = changed || gunResult.hit
  }

  if (changed || acted) {
    updateRender()
  }

  evaluateEnemyAttacks()
}

export function movePlayer(dx, dy) {
  let new_pos = State.player_pos.clone()
  new_pos.x += dx
  new_pos.y += dy
  let nextHash = new_pos.hash()

  if (!(nextHash in State.maze)) return

  if (State.maze[nextHash] === CellType.ENEMY_MELEE || State.maze[nextHash] === CellType.ENEMY_RANGED) {
    return
  }

  if (State.maze[nextHash] === CellType.DOOR) {
    let doorColor = State.doorColorByHash[nextHash]
    let matchingKeys = State.keyInventory[doorColor] ?? 0
    if (matchingKeys === 0) {
      return
    }
  }

  if (State.maze[nextHash] === CellType.KEY) {
    let keyColor = State.keyColorByHash[nextHash]
    State.keyInventory[keyColor] = (State.keyInventory[keyColor] ?? 0) + 1
    delete State.keyColorByHash[nextHash]
    State.maze[nextHash] = CellType.OPEN
  }

  if (State.maze[nextHash] === CellType.SWORD) {
    State.weaponInventory.sword = true
    State.maze[nextHash] = CellType.OPEN
  }

  if (State.maze[nextHash] === CellType.GUN) {
    State.weaponInventory.gun = true
    State.maze[nextHash] = CellType.OPEN
  }

  if (State.maze[nextHash] === CellType.END) {
    State.floor++
    State.player_pos = new Pos(0, 0)
    State.playerMoveTick++
    generateMaze()
    updateRender()
    evaluateEnemyAttacks()
    return
  }

  State.player_pos = new_pos
  State.playerMoveTick++
  updateRender()
  evaluateEnemyAttacks()
}

export function handleInput(event) {
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
    case " ":
    case "Spacebar":
    case "Space":
      event.preventDefault()
      useWeaponAction()
      break
  }
}
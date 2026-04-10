import { Pos } from "./pos.js"

const PATROL_TORCH_RANGE = 7
const PLAYER_LIGHT_MAX_DARKNESS = 0.82
const LIGHT_TWEEN_DURATION_MS = 180

let lightAnimationFrameId = null
let previousPlayerLightDarknessByHash = {}
let previousPatrolTorchByHash = {}

export function getPatrolTorchStrengthByHash(patrolEnemyPos, canSeePosFrom) {
  let strengthByHash = {}

  if (patrolEnemyPos === null) {
    return strengthByHash
  }

  for (let dx = -PATROL_TORCH_RANGE; dx <= PATROL_TORCH_RANGE; dx++) {
    for (let dy = -PATROL_TORCH_RANGE; dy <= PATROL_TORCH_RANGE; dy++) {
      let distance = Math.hypot(dx, dy)
      if (distance > PATROL_TORCH_RANGE) {
        continue
      }

      let pos = new Pos(patrolEnemyPos.x + dx, patrolEnemyPos.y + dy)
      let hash = pos.hash()
      if (!canSeePosFrom(patrolEnemyPos, pos)) {
        continue
      }

      let normalizedDistance = distance / Math.max(1, PATROL_TORCH_RANGE)
      let strength = Math.max(0, 1 - normalizedDistance)
      strength = Math.pow(strength, 1.35)

      if (strength <= 0) {
        continue
      }

      strengthByHash[hash] = strength
    }
  }

  return strengthByHash
}

export function getPlayerLightDarkness(mazePos, playerPos, viewSize) {
  let maxDistance = Math.max(1, Math.floor(viewSize / 2))
  let distance = Math.hypot(mazePos.x - playerPos.x, mazePos.y - playerPos.y)
  let normalizedDistance = Math.min(1, distance / maxDistance)
  let curvedFalloff = Math.pow(normalizedDistance, 1.45)
  return curvedFalloff * PLAYER_LIGHT_MAX_DARKNESS
}

export function createLightingFrameState() {
  return {
    nextPlayerLightDarknessByHash: {},
    nextPatrolTorchByHash: {}
  }
}

export function createLightTargetForCell(frameState, params) {
  let {
    cell,
    mazeHash,
    mazePos,
    playerPos,
    viewSize,
    visibleHashes,
    connectedVisiblePath,
    connectedVisibleWalls,
    patrolTorchStrengthByHash
  } = params

  let isLitCell = visibleHashes.has(mazeHash) && (connectedVisiblePath.has(mazeHash) || connectedVisibleWalls.has(mazeHash))
  let patrolTorchStrength = isLitCell && (mazeHash in patrolTorchStrengthByHash)
    ? patrolTorchStrengthByHash[mazeHash]
    : 0
  let playerLightDarkness = isLitCell
    ? getPlayerLightDarkness(mazePos, playerPos, viewSize)
    : 1

  frameState.nextPlayerLightDarknessByHash[mazeHash] = playerLightDarkness
  frameState.nextPatrolTorchByHash[mazeHash] = patrolTorchStrength

  let previousDarkness = mazeHash in previousPlayerLightDarknessByHash
    ? previousPlayerLightDarknessByHash[mazeHash]
    : playerLightDarkness
  let previousTorch = mazeHash in previousPatrolTorchByHash
    ? previousPatrolTorchByHash[mazeHash]
    : patrolTorchStrength

  return {
    cell,
    fromDarkness: previousDarkness,
    toDarkness: playerLightDarkness,
    fromTorch: previousTorch,
    toTorch: patrolTorchStrength
  }
}

export function finalizeLightingFrame(frameState) {
  previousPlayerLightDarknessByHash = frameState.nextPlayerLightDarknessByHash
  previousPatrolTorchByHash = frameState.nextPatrolTorchByHash
}

function startLightTween(targets) {
  if (lightAnimationFrameId !== null) {
    cancelAnimationFrame(lightAnimationFrameId)
    lightAnimationFrameId = null
  }

  let startTime = null

  let step = function(timestamp) {
    if (startTime === null) {
      startTime = timestamp
    }

    let progress = Math.min(1, (timestamp - startTime) / LIGHT_TWEEN_DURATION_MS)

    for (let target of targets) {
      let darkness = target.fromDarkness + ((target.toDarkness - target.fromDarkness) * progress)
      let torch = target.fromTorch + ((target.toTorch - target.fromTorch) * progress)

      target.cell.style.setProperty("--player-light-darkness", String(darkness))
      target.cell.style.setProperty("--patrol-torch-alpha", String(torch))
    }

    if (progress < 1) {
      lightAnimationFrameId = requestAnimationFrame(step)
      return
    }

    lightAnimationFrameId = null
  }

  lightAnimationFrameId = requestAnimationFrame(step)
}

function applyLightValuesDirect(targets) {
  for (let target of targets) {
    target.cell.style.setProperty("--player-light-darkness", String(target.toDarkness))
    target.cell.style.setProperty("--patrol-torch-alpha", String(target.toTorch))
  }
}

export function applyLightingTargets(targets, shouldTween) {
  if (shouldTween) {
    startLightTween(targets)
    return
  }

  if (lightAnimationFrameId === null) {
    applyLightValuesDirect(targets)
  }
}

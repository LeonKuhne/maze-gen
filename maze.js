import { Pos } from "./pos.js"
import { Config } from "./config.js"
import { State } from "./state.js"
import { CellType } from "./cell.js"

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

export function generateMaze() {
  State.maze = {}

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

    if (num_cells > 0 && creates2x2OpenSpace(pos)) {
      continue
    }

    State.maze[pos.hash()] = CellType.OPEN
    last_open_pos = pos
    num_cells++

    let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    directions.sort(() => Math.random() - 0.5)

    for (let [dx, dy] of directions) {
      let new_pos = new Pos(pos.x + dx, pos.y + dy)
      if (!(new_pos.hash() in State.maze)) {
        stack.push(new_pos)
      }
    }
  }

  if (last_open_pos !== null) {
    State.maze[last_open_pos.hash()] = CellType.END
  }
}

import { Pos } from "./pos.js"

export class State { 
  static view = []
  static maze = {}
  static player_pos = new Pos(0, 0)
  static floor = 1
  static playerMoveTick = 0
  static keyInventory = {}
  static keyPickupOrder = []
  static keyColorByHash = {}
  static doorColorByHash = {}
  static homeColorByHash = {}
  static safetyColorByHash = {}
  static hazardActive = false
  static hazardColor = ""
  static hazardElapsedMs = 0
  static warningClearActive = false
  static warningClearColor = ""
  static warningClearElapsedMs = 0
  static warningClearStartProgress = 0
  static gameOver = false
  static isPaused = false
}
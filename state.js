import { Pos } from "./pos.js"

export class State { 
  static view = []
  static maze = {}
  static player_pos = new Pos(0, 0)
  static floor = 1
  static playerMoveTick = 0
  static coins = 0
  static keyInventory = {}
  static keyPickupOrder = []
  static keyColorByHash = {}
  static doorColorByHash = {}
  static homeColorByHash = {}
  static homeHash = null
  static safetyColorByHash = {}
  static hazardActive = false
  static hazardColor = ""
  static hazardElapsedMs = 0
  static warningClearActive = false
  static warningClearColor = ""
  static warningClearElapsedMs = 0
  static warningClearStartProgress = 0
  static teleporterUpHash = null
  static teleporterDownHash = null
  static teleporterPlacementTarget = "up"
  static teleporterUnlocked = false
  static drillUnlocked = false
  static recallUnlocked = false
  static teleporterBindCode = null
  static drillBindCode = null
  static recallBindCode = null
  static bindCaptureItem = null
  static gameOver = false
  static isPaused = false
}
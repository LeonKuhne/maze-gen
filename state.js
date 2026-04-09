import { Pos } from "./pos.js"

export class State { 
  static view = []
  static maze = {}
  static player_pos = new Pos(0, 0)
  static floor = 1
  static playerMoveTick = 0
  static playerActionType = ""
  static playerActionTick = 0
  static weaponInventory = { sword: false, gun: false }
  static keyInventory = {}
  static keyColorByHash = {}
  static doorColorByHash = {}
  static enemyAttackTimeoutByHash = {}
  static enemyActionByHash = {}
  static enemyBulletHashes = new Set()
  static enemyBulletTimerId = null
}
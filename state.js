import { Pos } from "./pos.js"

export class State { 
  static view = []
  static maze = {}
  static player_pos = new Pos(0, 0)
  static floor = 1
  static playerMoveTick = 0
  static keyInventory = {}
  static keyColorByHash = {}
  static doorColorByHash = {}
}
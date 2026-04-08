import { Pos } from "./pos.js"
import { Config } from "./config.js"

export class State { 
  static view = []
  static maze = {}
  static player_pos = new Pos(Math.floor(Config.maze_size / 2), Math.floor(Config.maze_size / 2))
}
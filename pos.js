export class Pos {
  constructor(x, y) {
    this.x = x
    this.y = y
  }
  clone() {
    return new Pos(this.x, this.y)
  }
  hash() {
    return `${this.x},${this.y}`
  }
  equals(other) {
    return this.x === other.x && this.y === other.y
  }
}
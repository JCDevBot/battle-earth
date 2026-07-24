export class SeededRandom {
  constructor(seed = 1) {
    this.seed = seed;
  }

  next() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  pick(items) {
    return items[Math.floor(this.next() * items.length)];
  }
}

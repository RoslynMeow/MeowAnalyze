// A tiny fixture used by the analyzer tests.

export function add(a: number, b: number): number {
  return a + b;
}

export function classify(n: number): string {
  if (n < 0) {
    return "negative";
  } else if (n === 0) {
    return "zero";
  }
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0 && i > 2) {
      return "even";
    }
  }
  return "positive";
}

export const abs = (x: number) => (x > 0 ? x : -x);

class Counter {
  private value = 0;

  increment(step: number): number {
    this.value += step;
    return this.value;
  }
}

export const counter = new Counter();

import { type Signal, signal } from '@preact/signals-core'

// NOTE: use .peek() in mutating methods so they do not auto-subscribe at their
// callsites. Basically anywhere we use triggerUpdate() we will use peek().

// TODO: Break out the read-only methods into ArrayComputed and then
// extend that and implement the mutating functions in ArraySignal

export class ArraySignal<T> {
  static get [Symbol.species]() {
    return ArraySignal
  }

  [Symbol.toStringTag] = 'ArraySignal'

  #storage: Signal<T[]>

  constructor(arr?: Iterable<T>) {
    this.#storage = signal(arr ? Array.from(arr) : [])
  }

  #triggerUpdate(): void {
    this.#storage.value = [...this.#storage.peek()]
  }

  get value(): T[] {
    return this.#storage.value
  }

  set value(newValue: T[]) {
    this.#storage.value = newValue
  }

  peek(): T[] {
    return this.#storage.peek()
  }

  subscribe(cb: (newValue: T[]) => void): () => void {
    return this.#storage.subscribe(cb)
  }

  *[Symbol.iterator](): IterableIterator<T> {
    const arr = this.#storage.value

    for (let i = 0; i < arr.length; ++i) {
      yield arr[i]
    }
  }

  at(index: number): T | undefined {
    return this.#storage.value.at(index)
  }

  clear(): void {
    this.#storage.peek().splice(0, this.#storage.value.length)
    this.#triggerUpdate()
  }

  concat(...args: T[]): ArraySignal<T> {
    const newStorage = this.#storage.value.concat(...args)
    return new ArraySignal(newStorage)
  }

  copyWithin(target: number, start: number, end?: number): ArraySignal<T> {
    this.#storage.peek().copyWithin(target, start, end)
    this.#triggerUpdate()
    return this
  }

  entries(): IterableIterator<T> {
    return this[Symbol.iterator]()
  }

  every(
    cb: (element: T, index: number, list: ArraySignal<T>) => boolean,
    thisArg?: unknown
  ): boolean {
    return this.#storage.value.every((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  fill(value: T, start?: number, end?: number): ArraySignal<T> {
    this.#storage.peek().fill(value, start, end)
    this.#triggerUpdate()
    return this
  }

  filter(
    cb: (elem: T, index: number, arr: ArraySignal<T>) => boolean,
    thisArg?: unknown
  ): ArraySignal<T> {
    const result = this.#storage.value.filter((element, index) => {
      return cb(element, index, this)
    }, thisArg)

    return new ArraySignal(result)
  }

  find(
    cb: (elem: T, index: number, arr: ArraySignal<T>) => unknown,
    thisArg?: unknown
  ): T | undefined {
    return this.#storage.value.find((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findIndex(
    cb: (elem: T, index: number, arr: ArraySignal<T>) => unknown,
    thisArg?: unknown
  ): number {
    return this.#storage.value.findIndex((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findLast(
    cb: (elem: T, index: number, arr: ArraySignal<T>) => unknown,
    thisArg?: unknown
  ): T | undefined {
    return this.#storage.value.findLast((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findLastIndex(
    cb: (elem: T, index: number, arr: ArraySignal<T>) => unknown,
    thisArg?: unknown
  ): number {
    return this.#storage.value.findLastIndex((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SEE: https://github.com/microsoft/TypeScript/blob/05f4dbab107f833bfcda8ebddf6c6b9e0cd61324/src/lib/es2019.array.d.ts#L29
  flat<D extends number = 1>(depth?: D): ArraySignal<FlatArray<T[], D>> {
    const newStorage = this.#storage.value.flat(depth)
    return new ArraySignal(newStorage)
  }

  flatMap<U>(cb: (value: T, index: number, array: ArraySignal<T>) => U | ReadonlyArray<U>): U[] {
    return this.#storage.value.flatMap((item, index) => {
      return cb(item, index, this)
    })
  }

  forEach(
    cb: (value: T, index: number, arr: ArraySignal<T>) => void,
    thisArg?: unknown
  ) {
    return this.#storage.value.forEach((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  static from<T>(arrayLike: ArrayLike<T>): ArraySignal<T>

  static from<T, U>(
    arrayLike: ArrayLike<T>,
    mapfn: (v: T, k: number) => U,
    thisArg?: unknown
  ): ArraySignal<U>

  static from<T, U>(
    arrayLike: ArrayLike<T>,
    mapFn?: (v: T, k: number) => U,
    thisArg?: unknown
  ): ArraySignal<T> | ArraySignal<U> {
    if (mapFn) {
      return new ArraySignal(Array.from(arrayLike, mapFn, thisArg))
    } else {
      return new ArraySignal(Array.from(arrayLike))
    }
  }

  // SKIP: static fromAsync()

  includes(searchElement: T, fromIndex?: number): boolean {
    return this.#storage.value.includes(searchElement, fromIndex)
  }

  indexOf(item: T, fromIndex?: number): number {
    return this.#storage.value.indexOf(item, fromIndex)
  }

  join(seperator?: string): string {
    return this.#storage.value.join(seperator)
  }

  keys(): IterableIterator<number> {
    return this.#storage.value.keys()
  }

  lastIndexOf(item: T, fromIndex?: number): number {
    if (fromIndex !== undefined) {
      return this.#storage.value.lastIndexOf(item, fromIndex)
    } else {
      // NOTE: undefined is coerced to 0 internally so this will search
      // backwards from 0 and nothing will ever be found
      return this.#storage.value.lastIndexOf(item)
    }
  }

  get length(): number {
    return this.#storage.value.length
  }

  map<R>(cb: (item: T, index: number, arr: ArraySignal<T>) => R, thisArg?: unknown): R[] {
    return this.#storage.value.map((item, index) => {
      return cb(item, index, this)
    }, thisArg)
  }

  static of<T>(...args: T[]): ArraySignal<T> {
    return new ArraySignal(Array.of(...args))
  }

  pop(): T | undefined {
    const result = this.#storage.peek().pop()
    this.#triggerUpdate()
    return result
  }

  push(...items: T[]): number {
    const result = this.#storage.peek().push(...items)
    this.#triggerUpdate()
    return result
  }

  reduce(cb: (acc: T, current: T, index: number, array: ArraySignal<T>) => T): T
  reduce(cb: (acc: T, current: T, index: number, array: ArraySignal<T>) => T, initialValue: T): T
  reduce<U>(cb: (acc: U, current: T, index: number, array: ArraySignal<T>) => U, initialValue: U): U

  reduce<A>(
    cb: <U extends A | T>(acc: U, current: T, index: number, array: ArraySignal<T>) => U,
    initialValue?: A
  ): unknown {
    if (initialValue !== undefined) {
      return this.#storage.value.reduce((acc: A, item: T, index): A => {
        return cb(acc, item, index, this)
      }, initialValue)
    } else {
      return this.#storage.value.reduce((acc: T, item: T, index): T => {
        return cb(acc, item, index, this)
      })
    }
  }

  reduceRight(cb: (acc: T, current: T, index: number, array: ArraySignal<T>) => T): T
  reduceRight(
    cb: (acc: T, current: T, index: number, array: ArraySignal<T>) => T,
    initialValue: T
  ): T
  reduceRight<U>(
    cb: (acc: U, current: T, index: number, array: ArraySignal<T>) => U,
    initialValue: U
  ): U

  reduceRight<A>(
    cb: <U extends A | T>(acc: U, current: T, index: number, array: ArraySignal<T>) => U,
    initialValue?: A
  ): unknown {
    if (initialValue !== undefined) {
      return this.#storage.value.reduceRight((acc: A, item: T, index): A => {
        return cb(acc, item, index, this)
      }, initialValue)
    } else {
      return this.#storage.value.reduceRight((acc: T, item: T, index): T => {
        return cb(acc, item, index, this)
      })
    }
  }

  reverse(): ArraySignal<T> {
    this.#storage.peek().reverse()
    this.#triggerUpdate()
    return this
  }

  shift(): T | undefined {
    const result = this.#storage.peek().shift()
    this.#triggerUpdate()
    return result
  }

  slice(start?: number, end?: number): ArraySignal<T> {
    return new ArraySignal(this.#storage.value.slice(start, end))
  }

  some(
    cb: (element: T, index: number, arr: ArraySignal<T>) => boolean,
    thisArg?: unknown
  ): boolean {
    return this.#storage.value.some((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  sort(compareFn?: (left: T, right: T) => number): ArraySignal<T> {
    this.#storage.peek().sort(compareFn)
    this.#triggerUpdate()
    return this
  }

  splice(start: number, deleteCount?: number): T[] {
    const result = this.#storage.peek().splice(start, deleteCount)
    this.#triggerUpdate()
    return result
  }

  toLocalString(): string {
    return this.#storage.value.toLocaleString()
  }

  toReversed(): ArraySignal<T> {
    return new ArraySignal(this.#storage.value.toReversed())
  }

  toSorted(compareFn?: (left: T, right: T) => number): ArraySignal<T> {
    return new ArraySignal(this.#storage.value.toSorted(compareFn))
  }

  toString(): string {
    return this.#storage.value.toString()
  }

  unshift(...elements: T[]): number {
    const result = this.#storage.peek().unshift(...elements)
    this.#triggerUpdate()
    return result
  }

  values(): IterableIterator<T> {
    return this.#storage.value.values()
  }

  with(index: number, value: T): ArraySignal<T> {
    return new ArraySignal(this.#storage.value.with(index, value))
  }
}

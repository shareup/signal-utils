import { computed, type ReadonlySignal, Signal } from '@preact/signals-core'
import { MemoizedArrayOfSignals } from './memoized-array-of-signals.ts'

// NOTE: intentionally not implementing methods which produce a copy, that
// defeats the purpose of having a stable memoized array of computeds

export class MemoizedComputeds<T, I, R> {
  static get [Symbol.species]() {
    return MemoizedComputeds
  }

  [Symbol.toStringTag] = 'MemoizedComputeds'

  #cache: Map<I, ReadonlySignal<R>>
  #idFn: (elem: R) => I
  // deno-lint-ignore no-explicit-any
  #signal: MemoizedArrayOfSignals<T, I> | MemoizedComputeds<any, I, T>
  #storage: ReadonlySignal<ReadonlySignal<R>[]>
  #transform: (elem: Signal<T>) => R

  get idFn() {
    return this.#idFn
  }

  constructor(
    // deno-lint-ignore no-explicit-any
    signal: MemoizedArrayOfSignals<T, I> | MemoizedComputeds<any, I, T>,
    transform: (elem: Signal<T>) => R,
    idFn: (elem: R) => I
  ) {
    this.#cache = new Map()
    this.#signal = signal
    this.#transform = transform
    this.#idFn = idFn

    this.#storage = computed(() => {
      const newStorage = this.#signal.map(sig => {
        const id = this.#signal.getID(sig)
        const possible = this.#cache.get(id)

        if (possible) { return possible }

        const comp = computed(() => this.#transform(sig))
        this.#cache.set(id, comp)
        return comp
      })

      for (const [id, _comp] of this.#cache) {
        if (!this.#signal.getByID(id)) {
          this.#cache.delete(id)
        }
      }

      return newStorage
    })
  }

  getID(comp: ReadonlySignal<R> | R): I {
    if (comp instanceof Signal) {
      return this.#idFn(comp.value)
    } else {
      return this.#idFn(comp)
    }
  }

  getByID(id: I): ReadonlySignal<R> | undefined {
    // NOTE: make sure the computed is not too lazy and has never been computed
    this.#storage.peek()
    return this.#cache.get(id)
  }

  computedById(id: I): ReadonlySignal<R | undefined> {
    return computed(() => {
      // NOTE: subscribe for updates from the storage array
      this.#storage.value

      return this.#cache.get(id)?.value
    })
  }

  get value(): ReadonlySignal<R>[] {
    return this.#storage.value
  }

  peek(): ReadonlySignal<R>[] {
    return this.#storage.peek()
  }

  subscribe(cb: (newValue: ReadonlySignal<R>[]) => void): () => void {
    return this.#storage.subscribe(cb)
  }

  *[Symbol.iterator](): IterableIterator<ReadonlySignal<R>> {
    for (const elem of this.#storage.value) {
      yield elem
    }
  }

  at(index: number): ReadonlySignal<R> | undefined {
    return this.#storage.value.at(index)
  }

  // SKIP: clear() - mutating method
  // SKIP: concat() - copying method
  // SKIP: copyWithin() - mutating method

  entries(): IterableIterator<ReadonlySignal<R>> {
    return this[Symbol.iterator]()
  }

  every(
    cb: (element: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => boolean,
    thisArg?: unknown
  ): boolean {
    return this.#storage.value.every((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: fill() - mutating method

  filter(
    cb: (elem: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => boolean,
    thisArg?: unknown
  ): ReadonlySignal<R>[] {
    return this.#storage.value.filter((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  find(
    cb: (elem: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => unknown,
    thisArg?: unknown
  ): ReadonlySignal<R> | undefined {
    return this.#storage.value.find((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findIndex(
    cb: (elem: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => unknown,
    thisArg?: unknown
  ): number {
    return this.#storage.value.findIndex((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findLast(
    cb: (elem: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => unknown,
    thisArg?: unknown
  ): ReadonlySignal<R> | undefined {
    return this.#storage.value.findLast((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findLastIndex(
    cb: (elem: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => unknown,
    thisArg?: unknown
  ): number {
    return this.#storage.value.findLastIndex((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: flat() - copying method

  flatMap<U>(
    cb: (
      value: ReadonlySignal<R>,
      index: number,
      array: MemoizedComputeds<T, I, R>
    ) => U | ReadonlyArray<U>
  ): U[] {
    return this.#storage.value.flatMap((item, index) => {
      return cb(item, index, this)
    })
  }

  forEach(
    cb: (elem: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => unknown,
    thisArg?: unknown
  ): void {
    return this.#storage.value.forEach((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: static from() - use the constructor
  // SKIP: static fromAsync()

  includes(item: ReadonlySignal<R> | R, fromIndex?: number): boolean {
    // NOTE: make sure the computed is not too lazy and has never been computed
    this.#storage.peek()

    const id = this.getID(item)
    const foundItem = this.#cache.get(id)

    if (foundItem === undefined) {
      return false
    }

    return this.#storage.value.includes(foundItem, fromIndex)
  }

  indexOf(item: ReadonlySignal<R> | R): number {
    // NOTE: make sure the computed is not too lazy and has never been computed
    this.#storage.peek()

    const id = this.getID(item)
    const foundItem = this.#cache.get(id)

    if (foundItem === undefined) {
      return -1
    }

    return this.#storage.value.indexOf(foundItem)
  }

  join(seperator?: string): string {
    return this.#storage.value.join(seperator)
  }

  keys(): IterableIterator<number> {
    return this.#storage.value.keys()
  }

  lastIndexOf(item: ReadonlySignal<R> | R, fromIndex?: number): number {
    // NOTE: make sure the computed is not too lazy and has never been computed
    this.#storage.peek()

    const id = this.getID(item)
    const foundItem = this.#cache.get(id)

    if (foundItem === undefined) {
      return -1
    }

    if (fromIndex) {
      return this.#storage.value.lastIndexOf(foundItem, fromIndex)
    } else {
      return this.#storage.value.lastIndexOf(foundItem)
    }
  }

  get length(): number {
    return this.#storage.value.length
  }

  map<M>(
    cb: (value: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => M,
    thisArg?: unknown
  ): M[] {
    return this.#storage.value.map((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: static of() – use the constructor
  // SKIP: pop() – mutating
  // SKIP: push() – mutating

  // NOTE: we intentionally only support this typing for reduce() and
  // reduceRight() which has an initial value. It doesn't make sense to
  // reduce into a ReadonlySignal<R> as the accumulator type.

  reduce<U>(
    cb: (acc: U, current: ReadonlySignal<R>, index: number, array: MemoizedComputeds<T, I, R>) => U,
    initialValue: U
  ): U {
    return this.#storage.value.reduce((acc: U, item: ReadonlySignal<R>, index): U => {
      return cb(acc, item, index, this)
    }, initialValue)
  }

  reduceRight<U>(
    cb: (acc: U, current: ReadonlySignal<R>, index: number, array: MemoizedComputeds<T, I, R>) => U,
    initialValue: U
  ): U {
    return this.#storage.value.reduceRight((acc: U, item: ReadonlySignal<R>, index): U => {
      return cb(acc, item, index, this)
    }, initialValue)
  }

  // SKIP: reverse() – mutating
  // SKIP: shift() – mutating
  // SKIP: slice() – copying method

  some(
    cb: (element: ReadonlySignal<R>, index: number, list: MemoizedComputeds<T, I, R>) => boolean,
    thisArg?: unknown
  ): boolean {
    return this.#storage.value.some((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: sort() – mutating
  // SKIP: splice() – mutating

  toLocalString(): string {
    return this.#storage.toLocaleString()
  }

  // SKIP: toReversed() - copying method
  // SKIP: toSorted() - copying method

  toString(): string {
    return this.#storage.toString()
  }

  // SKIP: unshift() – mutating

  values(): IterableIterator<ReadonlySignal<R>> {
    return this.#storage.value.values()
  }

  // SKIP: with() - copying method
}

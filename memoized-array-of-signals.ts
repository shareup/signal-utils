import { computed, effect, type ReadonlySignal, Signal, signal } from '@preact/signals-core'
import { complexSignal } from './complex-signal.ts'

// NOTE: intentionally not implementing methods which produce a copy, that
// defeats the purpose of having a stable memoized array of signals

const notFound = Symbol('not-found')

export class MemoizedArrayOfSignals<T, I = T> {
  static get [Symbol.species]() {
    return MemoizedArrayOfSignals
  }

  [Symbol.toStringTag] = 'MemoizedArrayOfSignals'

  #cache: Map<I, Signal<T>>
  #idFn: (elem: T) => I
  #storage: Signal<Signal<T>[]>

  static fromSignal<T, I>(
    signal: Signal<T[]>,
    identityFn: (elem: T) => I
  ): [MemoizedArrayOfSignals<T, I>, () => void] {
    const mem = new MemoizedArrayOfSignals<T, I>(signal.value, identityFn)

    const dispose = effect(() => {
      mem.value = signal.value
    })

    return [mem, dispose]
  }

  get idFn() {
    return this.#idFn
  }

  constructor(list: Iterable<T> = [], identityFn: (elem: T) => I) {
    this.#idFn = identityFn
    this.#cache = new Map()

    if (list) {
      const signals = []

      for (const item of list) {
        const sig = this.#cacheItem(item)
        signals.push(sig)
      }

      this.#storage = complexSignal(signals)
    } else {
      this.#storage = complexSignal([])
    }
  }

  getID(sig: Signal<T> | T): I {
    if (sig instanceof Signal) {
      return this.#idFn(sig.peek())
    } else {
      return this.#idFn(sig)
    }
  }

  getByID(id: I): Signal<T> | undefined {
    return this.#cache.get(id)
  }

  computedById(id: I): ReadonlySignal<T | undefined> {
    return computed(() => {
      // NOTE: subscribe for updates from the storage array
      this.#storage.value

      return this.#cache.get(id)?.value
    })
  }

  #getCachedItem(item: Signal<T> | T): Signal<T> | typeof notFound {
    const id = this.getID(item)
    const possible = this.getByID(id)

    if (possible) {
      return possible
    } else {
      if (item instanceof Signal) {
        return item
      } else {
        return notFound
      }
    }
  }

  #cacheItem(item: Signal<T> | T): Signal<T> {
    const id = this.getID(item)
    const possible = this.getByID(id)

    if (possible) {
      return possible
    } else {
      if (item instanceof Signal) {
        this.#cache.set(id, item)
        return item
      } else {
        const sig = signal(item)
        this.#cache.set(id, sig)
        return sig
      }
    }
  }

  #cacheItems(items: (T | Signal<T>)[]): Signal<T>[] {
    return items.map(this.#cacheItem.bind(this))
  }

  get value(): Signal<T>[] {
    return this.#storage.value
  }

  set value(newItems: T[]) {
    const prev = Array.from(this.#storage.peek())
    const prevIds = new Set(prev.map(i => this.#idFn(i.peek())))
    const newIds = new Set()
    const newOrder: Signal<T>[] = []
    let skipValueAssign = false

    for (const item of newItems) {
      const id = this.#idFn(item)
      newIds.add(id)

      const existing = this.getByID(id)

      if (existing) {
        existing.value = item
        newOrder.push(existing)
      } else {
        newOrder.push(this.#cacheItem(item))
      }
    }

    if (prev.length === newOrder.length) {
      let isSame = true

      for (const i in prev) {
        if (prev[i] !== newOrder[i]) {
          isSame = false
          break
        }
      }

      if (isSame) {
        skipValueAssign = true
      }
    }

    for (const id of prevIds) {
      if (!newIds.has(id)) {
        this.#cache.delete(id)
      }
    }

    if (!skipValueAssign) {
      this.#storage.value = newOrder
    }
  }

  peek(): Signal<T>[] {
    return this.#storage.peek()
  }

  subscribe(cb: (newValue: Signal<T>[]) => void): () => void {
    return this.#storage.subscribe(cb)
  }

  *[Symbol.iterator](): IterableIterator<Signal<T>> {
    for (const elem of this.#storage.value) {
      yield elem
    }
  }

  at(index: number): Signal<T> | undefined {
    return this.#storage.value.at(index)
  }

  clear(): void {
    this.#storage.value.length = 0
    this.#cache.clear()
  }

  // SKIP: concat() - copying method

  copyWithin(target: number, start: number, end?: number): MemoizedArrayOfSignals<T, I> {
    this.#storage.value.copyWithin(target, start, end)
    return this
  }

  entries(): IterableIterator<Signal<T>> {
    return this[Symbol.iterator]()
  }

  every(
    cb: (element: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => boolean,
    thisArg?: unknown
  ): boolean {
    return this.#storage.value.every((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  fill(value: Signal<T> | T, start?: number, end?: number): MemoizedArrayOfSignals<T, I> {
    this.#storage.value.fill(this.#cacheItem(value), start, end)
    return this
  }

  filter(
    cb: (elem: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => boolean,
    thisArg?: unknown
  ): Signal<T>[] {
    return Array.from(this).filter((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  find(
    cb: (elem: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => unknown,
    thisArg?: unknown
  ): Signal<T> | undefined {
    return this.#storage.value.find((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findIndex(
    cb: (elem: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => unknown,
    thisArg?: unknown
  ): number {
    return this.#storage.value.findIndex((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findLast(
    cb: (elem: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => unknown,
    thisArg?: unknown
  ): Signal<T> | undefined {
    return this.#storage.value.findLast((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  findLastIndex(
    cb: (elem: Signal<T>, index: number, arr: MemoizedArrayOfSignals<T, I>) => unknown,
    thisArg?: unknown
  ): number {
    return this.#storage.value.findLastIndex((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: flat() - copying method

  flatMap<U>(
    cb: (
      value: Signal<T>,
      index: number,
      array: MemoizedArrayOfSignals<T, I>
    ) => U | ReadonlyArray<U>
  ): U[] {
    return this.#storage.value.flatMap((item, index) => {
      return cb(item, index, this)
    })
  }

  forEach(
    cb: (value: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => void,
    thisArg?: unknown
  ) {
    return this.#storage.value.forEach((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: static from() - use the constructor
  // SKIP: static fromAsync()

  includes(item: Signal<T> | T, fromIndex?: number): boolean {
    const foundItem = this.#getCachedItem(item)

    if (foundItem === notFound) {
      return false
    }

    return this.#storage.value.includes(foundItem, fromIndex)
  }

  indexOf(item: Signal<T> | T, fromIndex?: number): number {
    const foundItem = this.#getCachedItem(item)

    if (foundItem === notFound) {
      return -1
    }

    if (fromIndex === undefined) {
      return this.#storage.value.indexOf(foundItem)
    }

    return this.#storage.value.indexOf(foundItem, fromIndex)
  }

  join(seperator?: string): string {
    return this.#storage.value.join(seperator)
  }

  keys(): IterableIterator<number> {
    return this.#storage.value.keys()
  }

  lastIndexOf(item: Signal<T> | T, fromIndex?: number): number {
    const foundItem = this.#getCachedItem(item)

    if (foundItem === notFound) {
      return -1
    }

    if (fromIndex === undefined) {
      return this.#storage.value.lastIndexOf(foundItem)
    }

    return this.#storage.value.lastIndexOf(foundItem, fromIndex)
  }

  get length(): number {
    return this.#storage.value.length
  }

  map<R>(
    cb: (value: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => R,
    thisArg?: unknown
  ): R[] {
    return this.#storage.value.map((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  // SKIP: static of() – use the constructor

  pop(): Signal<T> | undefined {
    return this.#storage.value.pop()
  }

  push(...items: (T | Signal<T>)[]): number {
    return this.#storage.value.push(...this.#cacheItems(items))
  }

  // NOTE: we intentionally only support this typing for reduce() and
  // reduceRight() which has an initial value. It doesn't make sense to
  // reduce into a Signal<T> as the accumulator type.

  reduce<U>(
    cb: (acc: U, current: Signal<T>, index: number, array: MemoizedArrayOfSignals<T, I>) => U,
    initialValue: U
  ): U {
    return this.#storage.value.reduce((acc: U, item: Signal<T>, index): U => {
      return cb(acc, item, index, this)
    }, initialValue)
  }

  reduceRight<U>(
    cb: (acc: U, current: Signal<T>, index: number, array: MemoizedArrayOfSignals<T, I>) => U,
    initialValue: U
  ): U {
    return this.#storage.value.reduceRight((acc: U, item: Signal<T>, index): U => {
      return cb(acc, item, index, this)
    }, initialValue)
  }

  reverse(): MemoizedArrayOfSignals<T, I> {
    this.#storage.value.reverse()
    return this
  }

  shift(): Signal<T> | undefined {
    const item = this.#storage.value.shift()

    if (item) {
      this.#cache.delete(this.getID(item))
    }

    return item
  }

  // SKIP: slice() – copying method

  some(
    cb: (element: Signal<T>, index: number, list: MemoizedArrayOfSignals<T, I>) => boolean,
    thisArg?: unknown
  ): boolean {
    return this.#storage.value.some((element, index) => {
      return cb(element, index, this)
    }, thisArg)
  }

  sort(compareFn?: (left: Signal<T>, right: Signal<T>) => number): MemoizedArrayOfSignals<T, I> {
    this.#storage.value.sort(compareFn)
    return this
  }

  splice(start: number, deleteCount?: number): Signal<T>[] {
    const items = this.#storage.value.splice(start, deleteCount)

    for (const item of items) {
      this.#cache.delete(this.getID(item))
    }

    return items
  }

  toLocalString(): string {
    return this.#storage.value.toLocaleString()
  }

  // SKIP: toReversed() - copying method
  // SKIP: toSorted() - copying method

  toString(): string {
    return this.#storage.value.toString()
  }

  unshift(...items: (Signal<T> | T)[]): number {
    const resolved = items.map(this.#cacheItem.bind(this))
    return this.#storage.value.unshift(...resolved)
  }

  values(): IterableIterator<Signal<T>> {
    return this.#storage.value.values()
  }

  // SKIP: with() - copying method
}

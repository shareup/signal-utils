import { batch, Signal, signal } from '@preact/signals-core'

const batchTheseArrayMethods = new Set([
  'clear',
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift'
])

const mapSetMutationMethods = new Set([
  'add',
  'clear',
  'delete',
  'set'
])

export function complexSignal<T extends object>(initialValue: T): Signal<T> {
  // NOTE: we use inner here so the object identity of the original object will
  // remain the same, we can update the signal and trigger effects by creating
  // a new outer object
  const sig = signal<{ inner: T }>({ inner: initialValue })
  // deno-lint-ignore no-explicit-any
  const proxies: WeakSet<typeof Proxy<any>> = new WeakSet()
  // NOTE: trigger an update by creating a new outer object
  const update = (): void => {
    sig.value = { inner: sig.value.inner }
  }

  // deno-lint-ignore no-explicit-any
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver)

      // NOTE: return nested signals as-is
      if (original instanceof Signal) {
        return original
      }

      // NOTE: wrap nested objects
      if (typeof original === 'object' && !proxies.has(original)) {
        // NOTE: cache the proxy so we only ever make a proxy once per object
        return target[prop] = wrap(original)
      }

      // NOTE: batch array mutation methods so we only trigger effects once
      if (
        Array.isArray(target)
        && typeof prop === 'string'
        && batchTheseArrayMethods.has(prop)
        && typeof original === 'function'
      ) {
        // NOTE: some array methods (like splice) make many assignments so we batch them
        // deno-lint-ignore no-explicit-any
        return (...args: any[]) => {
          return batch(() => {
            return original.call(receiver, ...args)
          })
        }
      }

      // NOTE: arrays are good now
      if (Array.isArray(target)) {
        return original
      }

      // NOTE: maps and sets are kinda annoying
      if (
        typeof original === 'function' && typeof prop === 'string'
        && (target instanceof Map || target instanceof Set)
      ) {
        if (mapSetMutationMethods.has(prop)) {
          // deno-lint-ignore no-explicit-any
          return (...args: any) => {
            update()
            return original.bind(target)(...args)
          }
        }

        if (typeof original === 'function') {
          return original.bind(target)
        }
      }

      // NOTE: I don't think this is necessary, but why not
      // if (typeof original === 'function') {
      //   return original.bind(target)
      // }

      return original
    },
    set(target, prop, newValue, receiver) {
      Reflect.set(target, prop, newValue, receiver)
      update()
      return true
    }
  }

  function wrap<W extends object>(obj: W) {
    const proxy = new Proxy(obj, handler)
    proxies.add(proxy)
    return proxy
  }

  sig.value.inner = wrap(sig.value.inner)

  return {
    ...sig,
    get value() {
      return sig.value.inner
    },
    set value(newValue: T) {
      sig.value = { inner: wrap(newValue) }
    },
    valueOf() {
      return sig.valueOf().inner
    },
    toJSON() {
      return sig.toJSON().inner
    },
    peek() {
      return sig.peek().inner
    },
    subscribe(cb) {
      return sig.subscribe(({ inner }) => cb(inner))
    }
  }
}

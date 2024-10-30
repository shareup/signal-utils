import { computed, effect, Signal, signal } from '@preact/signals-core'
import { assert, assertEquals, assertInstanceOf } from '@std/assert'
import { complexSignal } from '../complex-signal.ts'

// TODO: break this up into many tests
Deno.test('can update a complex signal', () => {
  let count = -1

  const sig = complexSignal({
    name: 'Initial name',
    array: [1, 2, 3],
    complexArray: [{ f: 1 }, { f: 2 }],
    innerObject: {
      down: 'here',
      foo: 'bar'
    },
    map: new Map([['one', 1]]),
    aSet: new Set([4, 5]),
    nestedSignal: signal('boo')
  })

  // NOTE: this effect will run so count will be 0 after this
  const dispose = effect(() => {
    sig.value
    count += 1
  })

  const fooComputed = computed(() => sig.value.innerObject.foo)

  const initialValue = sig.value
  const initialName = sig.value.name
  const initialArrayObject = sig.value.array
  const initialInnerObject = sig.value.innerObject
  const initialInnerObjectDownValue = sig.value.innerObject.down

  sig.value.name = 'Updated name'
  assertEquals(count, 1)

  // NOTE: the object identity of the root value object does not change after an update
  assert(initialValue === sig.value)
  // NOTE: we updated the string, so it of course changed
  assert(initialName !== sig.value.name)
  // NOTE: we did not modify the array so it should be the exact same identical object
  assert(initialArrayObject === sig.value.array)
  // NOTE: we did not modify the inner object so it should be the exact same identical object
  assert(initialInnerObject === sig.value.innerObject)

  sig.value.innerObject.down = 'there'
  assertEquals(count, 2)

  // NOTE: even tho we edited the property of the innerObject, the innerObject itself did not change
  assert(initialInnerObject === sig.value.innerObject)
  // NOTE: the property inside the innerObject obviously did change tho
  assert(initialInnerObjectDownValue !== sig.value.innerObject.down)

  // NOTE: test that Object.assign() triggers effects
  Object.assign(sig.value.innerObject, { foo: 'baz' })
  // NOTE: the root object's identity has not changed
  assert(initialInnerObject === sig.value.innerObject)
  // NOTE: the new value is reflected from the computed
  assertEquals(fooComputed.value, 'baz')
  assertEquals(count, 3)

  // NOTE: let's setup a computed on the nested array value (proxy)
  const mapped = computed(() => sig.value.array.map(a => a + 1).join(','))
  // NOTE: mutate the array in-place
  sig.value.array.splice(0, 1)

  // NOTE: the object identity of the array hasn't changed
  assert(initialArrayObject === sig.value.array)
  // NOTE: the new value is reflected
  assertEquals(sig.value.array, [2, 3])
  assertEquals(sig.value.array.toString(), '2,3')
  assertEquals(sig.value.array.toLocaleString(), '2,3')
  // NOTE: the computed updated
  assertEquals(mapped.value, '3,4')
  // NOTE: the effect only ran once (splice() works by making multiple
  // adjustments which we make sure is batched)
  assertEquals(count, 4)

  // NOTE: mutate the array in-place
  sig.value.array.reverse()
  // NOTE: the new value is reflected
  assertEquals(sig.value.array, [3, 2])
  assert(sig.value.array.includes(3))
  assert(!sig.value.array.includes(4))
  // NOTE: the computed updated
  assertEquals(mapped.value, '4,3')
  assertEquals(count, 5)

  // NOTE: Maps work
  sig.value.map.set('two', 2)
  assertEquals(Array.from(sig.value.map.values()), [1, 2])
  assertEquals(count, 6)

  // NOTE: Sets work
  sig.value.aSet.add(6)
  assertEquals(Array.from(sig.value.aSet.values()), [4, 5, 6])
  assertEquals(count, 7)

  sig.value.aSet.clear()
  assertEquals(Array.from(sig.value.aSet.values()), [])
  assertEquals(count, 8)

  // NOTE: reassign works
  sig.value = { ...sig.value, name: 'New name!' }
  assertEquals(sig.value.name, 'New name!')
  assertEquals(count, 9)

  const f1 = sig.value.complexArray[0]
  assert(f1 === sig.value.complexArray.at(0))
  f1.f = 3
  assertEquals(count, 10)

  const nestedSig = sig.value.nestedSignal
  nestedSig.value = ':ghost:'
  // NOTE: updating a nested signal does not update the parent object
  assertEquals(count, 10)

  dispose()
})

import { computed, effect, signal } from '@preact/signals-core'
import { assert, assertEquals, assertExists, assertStrictEquals } from '@std/assert'
import { MemoizedArrayOfSignals } from '../memoized-array-of-signals.ts'

Deno.test('MemoizedArrayOfSignals works', () => {
  const disposes: (() => void)[] = []

  try {
    const list = new MemoizedArrayOfSignals([{
      id: 'a',
      name: 'Arnold'
    }, {
      id: 'b',
      name: 'Beverly'
    }], i => i.id)

    let listEffectCount = 0
    let recordAEffectCount = 0
    let recordANameEffectCount = 0

    disposes.push(effect(() => {
      list.length // subscribe
      listEffectCount += 1
    }))

    const a = list.at(0)

    assertExists(a)
    assertEquals(a.value.id, 'a')

    disposes.push(effect(() => {
      a.value // subscribe
      recordAEffectCount += 1
    }))

    const aName = computed(() => a.value.name)

    disposes.push(effect(() => {
      aName.value // subscribe
      recordANameEffectCount += 1
    }))

    // NOTE: effect counts start at 1
    assertEquals(1, listEffectCount)
    assertEquals(1, recordAEffectCount)
    // NOTE: elements start out in the order they were provided
    assertEquals(['a', 'b'], list.map(i => i.value.id))

    list.reverse()

    // NOTE: reversing the list will trigger the list-level effect
    assertEquals(2, listEffectCount)
    // NOTE: the a record effect is not triggered
    assertEquals(1, recordAEffectCount)
    assertEquals(1, recordANameEffectCount)
    assertEquals(['b', 'a'], list.map(i => i.value.id))

    // deno-lint-ignore no-non-null-assertion
    const aAgain = list.at(1)!
    // NOTE: anytime we get a signal we always get the exact same object
    assertStrictEquals(a, aAgain)

    a.value = { id: 'a', name: 'Alex' }

    // NOTE: assigning the a record will trigger its effect
    assertEquals(2, recordAEffectCount)
    // NOTE: the a.name changes do the effect is triggered
    assertEquals(2, recordANameEffectCount)
    // NOTE: the list-level effect will not trigger
    assertEquals(2, listEffectCount)
    assertEquals(['b', 'a'], list.map(i => i.value.id))

    list.value = [{
      id: 'b',
      name: 'Cherry'
    }, {
      id: 'a',
      name: 'Alex'
    }]

    // NOTE: if we re-assign the list value and all the elements are the
    // same and in the same order, then the list effect is not triggered
    assertEquals(2, listEffectCount)
    // NOTE: the a record is technically re-assign, so its effect is
    // triggered
    assertEquals(3, recordAEffectCount)
    // NOTE: A computed of a's name or id wouldn't be triggered tho
    assertEquals(2, recordANameEffectCount)
    assertEquals(['b', 'a'], list.map(i => i.value.id))

    list.value = [{
      id: 'a',
      name: 'Alex'
    }, {
      id: 'b',
      name: 'Cherry'
    }]

    // NOTE: assigning a different order does trigger the list-level effect
    assertEquals(3, listEffectCount)
    // NOTE: the a record is technically re-assigned yet again
    assertEquals(4, recordAEffectCount)
    // NOTE: the name is still not triggered tho
    assertEquals(2, recordANameEffectCount)
    assertEquals(['a', 'b'], list.map(i => i.value.id))
  } finally {
    disposes.forEach(cb => cb())
  }
})

Deno.test('can get the same ID for the same element each time', () => {
  const list = new MemoizedArrayOfSignals([{
    id: 'a',
    name: 'Arnold'
  }, {
    id: 'b',
    name: 'Beverly'
  }], i => i.id)

  assertEquals(list.getID({ id: 'a', name: 'Whatever' }), 'a')
  assertEquals(list.getID({ id: 'a', name: 'Something else' }), 'a')
})

Deno.test('all mutation methods trigger subscription updates for MemoizedArrayOfSignals', () => {
  let count = 0

  const arr = new MemoizedArrayOfSignals(['a', 'c', 'e'], el => String(el))

  const dispose = arr.subscribe(() => {
    count += 1
  })

  try {
    // NOTE: subscribe() is called initially when setup
    assertEquals(count, 1)

    arr.copyWithin(1, 2)
    assertEquals(count, 2)
    assertEquals(arr.join(', '), 'a, e, e')
    assertStrictEquals(arr.at(1), arr.at(2))

    arr.fill('b')
    assertEquals(count, 3)
    assertEquals(arr.join(', '), 'b, b, b')
    assertStrictEquals(arr.at(0), arr.at(1))
    assertStrictEquals(arr.at(1), arr.at(2))

    arr.clear()
    assertEquals(count, 4)
    assertEquals(arr.join(', '), '')

    arr.push('a', 'b', 'c', 'd')
    assertEquals(count, 5)
    assertEquals(arr.join(', '), 'a, b, c, d')

    const popped = arr.pop()
    assertEquals(count, 6)
    assertEquals(popped?.value, 'd')
    assertEquals(arr.join(', '), 'a, b, c')

    arr.reverse()
    assertEquals(count, 7)
    assertEquals(arr.join(', '), 'c, b, a')

    const shifted = arr.shift()
    assertEquals(count, 8)
    assertEquals(shifted?.value, 'c')
    assertEquals(arr.join(', '), 'b, a')

    arr.sort()
    assertEquals(count, 9)
    assertEquals(arr.join(', '), 'a, b')

    arr.splice(1, 1)
    assertEquals(count, 10)
    assertEquals(arr.join(', '), 'a')

    arr.unshift('c', 'b')
    assertEquals(count, 11)
    assertEquals(arr.join(', '), 'c, b, a')
  } finally {
    dispose()
  }
})

Deno.test('peek() does not subscribe', () => {
  let count = 0

  const arr = new MemoizedArrayOfSignals<string>([], el => String(el))

  const dispose = effect(() => {
    count += arr.peek().length
  })

  try {
    arr.push('g')
    // NOTE: count didn't move
    assertEquals(count, 0)
  } finally {
    dispose()
  }
})

Deno.test("can get a computed for an item by ID even if that item doesn't exist yet", () => {
  const list = new MemoizedArrayOfSignals([{
    id: 'a',
    name: 'Arnold'
  }, {
    id: 'b',
    name: 'Beverly'
  }], i => i.id)

  const b = list.computedById('b')
  const c = list.computedById('c')

  assertEquals(b.value?.id, 'b')
  assertEquals(c.value, undefined)

  list.value = [{
    id: 'a',
    name: 'Arnold'
  }, {
    id: 'c',
    name: 'Charlie'
  }]

  assertEquals(b.value, undefined)
  assertEquals(c.value?.id, 'c')

  list.value = [{
    id: 'a',
    name: 'Arnold'
  }]

  assertEquals(b.value, undefined)
  assertEquals(c.value, undefined)
})

function assertSubscribesAndEquals<T, E>(
  computedCB: (arr: MemoizedArrayOfSignals<T>) => E,
  initialValue: T[],
  firstExpectedValue: E,
  secondValue: T[],
  secondExpectedValue: E
): void {
  const arr = new MemoizedArrayOfSignals(initialValue, i => i)
  let compCount = 0

  const comp = computed(() => {
    compCount += 1
    assertEquals(computedCB(arr), compCount === 2 ? secondExpectedValue : firstExpectedValue)
    return true
  })

  assert(comp.value)
  assertEquals(compCount, 1)

  arr.value = secondValue

  assert(comp.value)
  assertEquals(compCount, 2)
}

Deno.test('at()', () => {
  assertSubscribesAndEquals(
    arr => arr.at(0)?.value,
    ['a'],
    'a',
    ['a', 'b'],
    'a'
  )

  assertSubscribesAndEquals(
    arr => arr.at(-1)?.value,
    ['a'],
    'a',
    ['a', 'b'],
    'b'
  )
})

Deno.test('find()', () => {
  assertSubscribesAndEquals(
    arr => arr.find(letter => letter.peek() === 'c')?.value,
    ['a', 'b', 'c'],
    'c',
    ['a', 'b'],
    undefined
  )
})

Deno.test('findIndex()', () => {
  assertSubscribesAndEquals(
    arr => arr.findIndex(letter => letter.peek() === 'c'),
    ['a', 'b', 'c', 'c'],
    2,
    ['a', 'b'],
    -1
  )
})

Deno.test('findLast()', () => {
  assertSubscribesAndEquals(
    arr => arr.findLast(letter => letter.peek() === 'c')?.value,
    ['a', 'b', 'c', 'c'],
    'c',
    ['a', 'b'],
    undefined
  )
})

Deno.test('findLastIndex()', () => {
  assertSubscribesAndEquals(
    arr => arr.findLastIndex(letter => letter.peek() === 'c'),
    ['a', 'b', 'c', 'c'],
    3,
    ['a', 'b'],
    -1
  )
})

Deno.test('includes()', () => {
  assertSubscribesAndEquals(
    arr => arr.includes('c'),
    ['a', 'b', 'c', 'c'],
    true,
    ['a', 'b'],
    false
  )
})

Deno.test('indexOf()', () => {
  assertSubscribesAndEquals(
    arr => arr.indexOf('c'),
    ['a', 'b', 'c', 'c'],
    2,
    ['a', 'b'],
    -1
  )
})

Deno.test('lastIndexOf()', () => {
  assertSubscribesAndEquals(
    arr => arr.lastIndexOf('c'),
    ['a', 'b', 'c', 'c'],
    3,
    ['a', 'b'],
    -1
  )
})

Deno.test('toLocaleString()', () => {
  assertSubscribesAndEquals(
    arr => arr.toLocaleString(),
    ['a', 'c', 'e', 'g'],
    'a,c,e,g',
    ['a', 'c', 'e'],
    'a,c,e'
  )
})

Deno.test('toString()', () => {
  assertSubscribesAndEquals(
    arr => arr.toString(),
    ['a', 'c', 'e', 'g'],
    'a,c,e,g',
    ['a', 'c', 'e'],
    'a,c,e'
  )
})

Deno.test('entries()', () => {
  assertSubscribesAndEquals(
    arr => Array.from(arr.entries()).toString(),
    ['a', 'c', 'e', 'g'],
    'a,c,e,g',
    ['a', 'c', 'e'],
    'a,c,e'
  )
})

Deno.test('values()', () => {
  assertSubscribesAndEquals(
    arr => Array.from(arr.values()).toString(),
    ['a', 'c', 'e', 'g'],
    'a,c,e,g',
    ['a', 'c', 'e'],
    'a,c,e'
  )
})

Deno.test('keys()', () => {
  assertSubscribesAndEquals(
    arr => Array.from(arr.keys()).toString(),
    ['a', 'c', 'e', 'g'],
    '0,1,2,3',
    ['a', 'c', 'e'],
    '0,1,2'
  )
})

Deno.test('iterator', () => {
  assertSubscribesAndEquals(
    arr => Array.from(arr).toString(),
    ['a', 'c', 'e', 'g'],
    'a,c,e,g',
    ['a', 'c', 'e'],
    'a,c,e'
  )
})

Deno.test('every()', () => {
  assertSubscribesAndEquals(
    arr => arr.every(letter => typeof letter.peek() === 'string'),
    ['a', 'c', 'e', 1],
    false,
    ['a', 'c', 'e'],
    true
  )
})

Deno.test('some()', () => {
  assertSubscribesAndEquals(
    arr => arr.some(letter => typeof letter.peek() === 'number'),
    ['a', 'c', 'e', 1],
    true,
    ['a', 'c', 'e'],
    false
  )
})

Deno.test('flatMap()', () => {
  assertSubscribesAndEquals(
    arr => arr.flatMap(letter => letter.value + '2').toString(),
    ['a', 'c', 'e', ['nested', 'array']],
    'a2,c2,e2,nested,array2',
    ['a', 'c', 'e'],
    'a2,c2,e2'
  )
})

// NOTE: we are still testing that the computed inside
// assertSubscribesAndEquals is computed twice so this is still a very valid
// test to show that forEach subscribes even if it always returned undefined
Deno.test('forEach()', () => {
  assertSubscribesAndEquals(
    arr => arr.forEach(letter => letter.value + '2'),
    ['a', 'c', 'e', 'g'],
    undefined,
    ['a', 'c', 'e'],
    undefined
  )
})

Deno.test('reduce()', () => {
  assertSubscribesAndEquals(
    arr => arr.reduce((acc, letter) => acc + letter.value, '^'),
    ['a', 'b', 'c', 'd'],
    '^abcd',
    ['a', 'b', 'c'],
    '^abc'
  )
})

Deno.test('reduceRight()', () => {
  assertSubscribesAndEquals(
    arr => arr.reduceRight((acc, letter) => acc + letter.value, '^'),
    ['a', 'b', 'c', 'd'],
    '^dcba',
    ['a', 'b', 'c'],
    '^cba'
  )
})

Deno.test('map()', () => {
  assertSubscribesAndEquals(
    arr => arr.map((letter, index) => letter.value + String(index)).toString(),
    ['a', 'b', 'c', 'd'],
    'a0,b1,c2,d3',
    ['a', 'b', 'c'],
    'a0,b1,c2'
  )
})

Deno.test('static fromSignal()', () => {
  const sig = signal(['a', 'b'])
  const [mem, dispose] = MemoizedArrayOfSignals.fromSignal(sig, i => i)

  try {
    assertEquals(Array.from(mem.map(i => i.value)), ['a', 'b'])

    sig.value = ['b', 'c']

    assertEquals(Array.from(mem.map(i => i.value)), ['b', 'c'])
  } finally {
    dispose()
  }
})

import { computed, effect, type Signal } from '@preact/signals-core'
import { assert, assertEquals, assertExists, assertStrictEquals } from '@std/assert'
import { MemoizedArrayOfSignals } from '../memoized-array-of-signals.ts'
import { MemoizedComputeds } from '../memoized-computeds.ts'

Deno.test('MemoizedComputeds work', () => {
  const base = new MemoizedArrayOfSignals(['Arnold', 'Beverly'], i => i[0])

  const disposes: (() => void)[] = []

  try {
    const list = new MemoizedComputeds(
      base,
      el => ({ id: el.value[0], name: el.value }),
      i => i.id
    )

    let listEffectCount = 0
    let recordAEffectCount = 0
    let recordANameEffectCount = 0

    disposes.push(effect(() => {
      list.length // subscribe
      listEffectCount += 1
    }))

    const a = list.at(0)

    assertExists(a)
    assertEquals(a.value.id, 'A')
    assertEquals(a.value.name, 'Arnold')

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
    assertEquals(['A', 'B'], list.map(i => i.value.id))

    base.reverse()

    // NOTE: reversing the list will trigger the list-level effect
    assertEquals(2, listEffectCount)
    // NOTE: the a record effect is not triggered
    assertEquals(1, recordAEffectCount)
    assertEquals(1, recordANameEffectCount)
    assertEquals(['B', 'A'], list.map(i => i.value.id))

    // deno-lint-ignore no-non-null-assertion
    const aAgain = list.at(1)!
    // NOTE: anytime we get a signal we always get the exact same object
    assertStrictEquals(a, aAgain)

    // deno-lint-ignore no-non-null-assertion
    const aBase = base.at(1)!
    assertEquals(aBase.value, 'Arnold')
    aBase.value = 'Alex'
    assertEquals(aBase.value, 'Alex')

    assertEquals(aAgain.value.name, aBase.value)

    // NOTE: assigning the a record will trigger its effect
    assertEquals(2, recordAEffectCount)
    // NOTE: the a.name changes do the effect is triggered
    assertEquals(2, recordANameEffectCount)
    // NOTE: the list-level effect will not trigger
    assertEquals(2, listEffectCount)
    assertEquals(['B', 'A'], list.map(i => i.value.id))

    base.value = ['Berry', 'Alex']

    // NOTE: if we re-assign the list value and all the elements are the
    // same and in the same order, then the list effect is not triggered
    assertEquals(2, listEffectCount)
    // NOTE: the a record is not re-assigned because techincally nothing
    // changed
    assertEquals(2, recordAEffectCount)
    // NOTE: A computed of a's name or id wouldn't be triggered tho
    assertEquals(2, recordANameEffectCount)
    assertEquals(['B', 'A'], list.map(i => i.value.id))

    base.value = ['Alex', 'Berry']

    // NOTE: assigning a different order does trigger the list-level effect
    assertEquals(3, listEffectCount)
    // NOTE: the a record is not re-assigned yet again, reodering doesn't change the computed
    assertEquals(2, recordAEffectCount)
    // NOTE: the name is still not triggered tho
    assertEquals(2, recordANameEffectCount)
    assertEquals(['A', 'B'], list.map(i => i.value.id))
  } finally {
    disposes.forEach(cb => cb())
  }
})

// TODO: can cascade through multiple memoized computeds

Deno.test('can get the same ID for the same element each time', () => {
  const base = new MemoizedArrayOfSignals(['Arnold', 'Beverly'], i => i[0])

  const list = new MemoizedComputeds(
    base,
    el => ({ id: el.value[0], name: el.value }),
    i => i.id
  )

  // deno-lint-ignore no-non-null-assertion
  const a = list.at(0)!

  assertEquals(list.getID(a), 'A')
  assertEquals(list.getID(a), 'A')
})

Deno.test('peek() does not subscribe', () => {
  let count = 0

  const base = new MemoizedArrayOfSignals<string>([], i => i[0])

  const list = new MemoizedComputeds(
    base,
    el => ({ id: el.value[0], name: el.value }),
    i => i.id
  )

  const dispose = effect(() => {
    count += list.peek().length
  })

  try {
    base.push('Gerald')
    // NOTE: count didn't move
    assertEquals(count, 0)
  } finally {
    dispose()
  }
})

Deno.test("can get a computed for an item by ID even if that item doesn't exist yet", () => {
  const base = new MemoizedArrayOfSignals(['Arnold', 'Beverly'], i => i[0])

  const list = new MemoizedComputeds(
    base,
    el => ({ id: el.value[0], name: el.value }),
    i => i.id
  )

  const b = list.computedById('B')
  const c = list.computedById('C')

  assertEquals(b.value?.id, 'B')
  assertEquals(c.value, undefined)

  base.value = ['Arnold', 'Charlie']

  assertEquals(b.value, undefined)
  assertEquals(c.value?.id, 'C')

  base.value = ['Arnold']

  assertEquals(b.value, undefined)
  assertEquals(c.value, undefined)
})

function assertSubscribesAndEquals<T, E>(
  transform: (item: Signal<T>) => T,
  computedCB: (comp: MemoizedComputeds<T, string, T>) => E,
  initialValue: T[],
  firstExpectedValue: E,
  secondValue: T[],
  secondExpectedValue: E
): void {
  const arr = new MemoizedArrayOfSignals<T, string>(initialValue, i => String(i))
  const comp = new MemoizedComputeds<T, string, T>(arr, transform, i => String(i).toLowerCase())

  let finalCompCount = 0

  const finalComp = computed(() => {
    finalCompCount += 1
    assertEquals(computedCB(comp), finalCompCount === 2 ? secondExpectedValue : firstExpectedValue)
    return true
  })

  assert(finalComp.value)
  assertEquals(finalCompCount, 1)

  arr.value = secondValue

  assert(finalComp.value)
  assertEquals(finalCompCount, 2)
}

Deno.test('at()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.at(0)?.value,
    ['a'],
    'A',
    ['a', 'b'],
    'A'
  )

  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.value.at(-1)?.value,
    ['a'],
    'A',
    ['a', 'b'],
    'B'
  )
})

Deno.test('find()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.find(letter => letter.peek() === 'C')?.value,
    ['a', 'b', 'c'],
    'C',
    ['a', 'b'],
    undefined
  )
})

Deno.test('findIndex()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.findIndex(letter => letter.peek() === 'C'),
    ['a', 'b', 'c', 'c'],
    2,
    ['a', 'b'],
    -1
  )
})

Deno.test('findLast()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.findLast(letter => letter.peek() === 'C')?.value,
    ['a', 'b', 'c', 'c'],
    'C',
    ['a', 'b'],
    undefined
  )
})

Deno.test('findLastIndex()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.findLastIndex(letter => letter.peek() === 'C'),
    ['a', 'b', 'c', 'c'],
    3,
    ['a', 'b'],
    -1
  )
})

Deno.test('includes()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.includes('C'),
    ['a', 'b', 'c', 'c'],
    true,
    ['a', 'b'],
    false
  )
})

Deno.test('indexOf()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.indexOf('C'),
    ['a', 'b', 'c', 'c'],
    2,
    ['a', 'b'],
    -1
  )
})

Deno.test('lastIndexOf()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.lastIndexOf('C'),
    ['a', 'b', 'c', 'c'],
    3,
    ['a', 'b'],
    -1
  )
})

Deno.test('toLocaleString()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.toLocalString(),
    ['a', 'c', 'e', 'g'],
    'A,C,E,G',
    ['a', 'c', 'e'],
    'A,C,E'
  )
})

Deno.test('toString()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.toString(),
    ['a', 'c', 'e', 'g'],
    'A,C,E,G',
    ['a', 'c', 'e'],
    'A,C,E'
  )
})

Deno.test('entries()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => Array.from(arr.entries()).toString(),
    ['a', 'c', 'e', 'g'],
    'A,C,E,G',
    ['a', 'c', 'e'],
    'A,C,E'
  )
})

Deno.test('values()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => Array.from(arr.values()).toString(),
    ['a', 'c', 'e', 'g'],
    'A,C,E,G',
    ['a', 'c', 'e'],
    'A,C,E'
  )
})

Deno.test('keys()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => Array.from(arr.keys()).toString(),
    ['a', 'c', 'e', 'g'],
    '0,1,2,3',
    ['a', 'c', 'e'],
    '0,1,2'
  )
})

Deno.test('iterator', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => Array.from(arr).toString(),
    ['a', 'c', 'e', 'g'],
    'A,C,E,G',
    ['a', 'c', 'e'],
    'A,C,E'
  )
})

Deno.test('every()', () => {
  assertSubscribesAndEquals(
    s => {
      if (typeof s.value === 'string') {
        return s.value.toUpperCase()
      } else {
        return s.value
      }
    },
    arr => arr.every(letter => typeof letter.peek() === 'string'),
    ['a', 'c', 'e', 1],
    false,
    ['a', 'c', 'e'],
    true
  )
})

Deno.test('some()', () => {
  assertSubscribesAndEquals(
    s => {
      if (typeof s.value === 'string') {
        return s.value.toUpperCase()
      } else {
        return s.value
      }
    },
    arr => arr.some(letter => typeof letter.peek() === 'number'),
    ['a', 'c', 'e', 1],
    true,
    ['a', 'c', 'e'],
    false
  )
})

Deno.test('flatMap()', () => {
  assertSubscribesAndEquals(
    s => {
      if (typeof s.value === 'string') {
        return s.value.toUpperCase()
      } else {
        return s.value.map(ss => ss.toUpperCase())
      }
    },
    arr => arr.flatMap(letter => letter.value + '2').toString(),
    ['a', 'c', 'e', ['nested', 'array']],
    'A2,C2,E2,NESTED,ARRAY2',
    ['a', 'c', 'e'],
    'A2,C2,E2'
  )
})

// NOTE: we are still testing that the computed inside
// assertSubscribesAndEquals is computed twice so this is still a very valid
// test to show that forEach subscribes even if it always returned undefined
Deno.test('forEach()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.forEach(letter => letter.value + '2'),
    ['a', 'c', 'e', 'g'],
    undefined,
    ['a', 'c', 'e'],
    undefined
  )
})

Deno.test('reduce()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.reduce((acc, letter) => acc + letter.value, '^'),
    ['a', 'b', 'c', 'd'],
    '^ABCD',
    ['a', 'b', 'c'],
    '^ABC'
  )
})

Deno.test('reduceRight()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.reduceRight((acc, letter) => acc + letter.value, '^'),
    ['a', 'b', 'c', 'd'],
    '^DCBA',
    ['a', 'b', 'c'],
    '^CBA'
  )
})

Deno.test('map()', () => {
  assertSubscribesAndEquals(
    s => s.value.toUpperCase(),
    arr => arr.map((letter, index) => letter.value + String(index)).toString(),
    ['a', 'b', 'c', 'd'],
    'A0,B1,C2,D3',
    ['a', 'b', 'c'],
    'A0,B1,C2'
  )
})

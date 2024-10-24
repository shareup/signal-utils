import { computed, effect } from '@preact/signals-core'
import { assert, assertEquals, assertInstanceOf } from '@std/assert'
import { ArraySignal } from '../mod.ts'

Deno.test('ArraySignal works, can be iterated over, can be used in computed() which reacts to changes', () => {
  const arr = new ArraySignal(['a', 'c', 'e'])

  const lengthComputed = computed(() => arr.length)

  const iterableComputed = computed(() => {
    const result: string[] = []

    for (const item of arr) {
      result.push(`+${item}`)
    }

    return result
  })

  assertEquals(lengthComputed.value, 3)
  assertEquals(iterableComputed.value.join(', '), '+a, +c, +e')

  arr.push('g')

  assertEquals(lengthComputed.value, 4)
  assertEquals(iterableComputed.value.join(', '), '+a, +c, +e, +g')

  arr.clear()

  assertEquals(lengthComputed.value, 0)
  assertEquals(iterableComputed.value.join(', '), '')
})

Deno.test('all mutation methods trigger subscription updates for ArraySignal', () => {
  let count = 0

  const arr = new ArraySignal(['a', 'c', 'e'])

  const dispose = arr.subscribe(() => {
    count += 1
  })

  try {
    // NOTE: subscribe() is called initially when setup
    assertEquals(count, 1)

    arr.copyWithin(1, 2)
    assertEquals(arr.join(', '), 'a, e, e')
    assertEquals(count, 2)

    arr.fill('b')
    assertEquals(arr.join(', '), 'b, b, b')
    assertEquals(count, 3)

    arr.clear()
    assertEquals(arr.join(', '), '')
    assertEquals(count, 4)

    arr.push('a', 'b', 'c', 'd')
    assertEquals(arr.join(', '), 'a, b, c, d')
    assertEquals(count, 5)

    const popped = arr.pop()
    assertEquals(popped, 'd')
    assertEquals(arr.join(', '), 'a, b, c')
    assertEquals(count, 6)

    arr.reverse()
    assertEquals(arr.join(', '), 'c, b, a')
    assertEquals(count, 7)

    const shifted = arr.shift()
    assertEquals(shifted, 'c')
    assertEquals(arr.join(', '), 'b, a')
    assertEquals(count, 8)

    arr.sort()
    assertEquals(arr.join(', '), 'a, b')
    assertEquals(count, 9)

    arr.splice(1, 1)
    assertEquals(arr.join(', '), 'a')
    assertEquals(count, 10)

    arr.unshift('c', 'b')
    assertEquals(arr.join(', '), 'c, b, a')
    assertEquals(count, 11)
  } finally {
    dispose()
  }
})

Deno.test('peek() does not subscribe', () => {
  let count = 0

  const arr = new ArraySignal<string>([])

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

Deno.test('all Array-like methods which make copies work', () => {
  const arr = new ArraySignal(['a', 'c', 'e'])
  const small = arr.filter(letter => letter >= 'c')

  assertEquals(small.join(', '), 'c, e')

  const slice = arr.slice(1, 3)
  assertEquals(slice.join(', '), 'c, e')

  const reversed = arr.toReversed()
  assertEquals(reversed.join(', '), 'e, c, a')

  const sorted = reversed.toSorted()
  assertEquals(sorted.join(', '), 'a, c, e')

  const withArr = arr.with(1, 'b')
  assertEquals(withArr.join(', '), 'a, b, e')
})

Deno.test('all Array-like static methods work', () => {
  const arrFrom = ArraySignal.from([1, 2, 3])

  assertInstanceOf(arrFrom, ArraySignal)
  assertEquals(arrFrom.length, 3)

  const arrOf = ArraySignal.of(1, 2, 3)

  assertInstanceOf(arrOf, ArraySignal)
  assertEquals(arrOf.length, 3)
})

function assertSubscribesAndEquals<T, E>(
  computedCB: (arr: ArraySignal<T>) => E,
  initialValue: T[],
  firstExpectedValue: E,
  secondValue: T[],
  secondExpectedValue: E
): void {
  const arr = new ArraySignal(initialValue)

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
    arr => arr.at(0),
    ['a'],
    'a',
    ['a', 'b'],
    'a'
  )

  assertSubscribesAndEquals(
    arr => arr.at(-1),
    ['a'],
    'a',
    ['a', 'b'],
    'b'
  )
})

Deno.test('find()', () => {
  assertSubscribesAndEquals(
    arr => arr.find(letter => letter === 'c'),
    ['a', 'b', 'c'],
    'c',
    ['a', 'b'],
    undefined
  )
})

Deno.test('findIndex()', () => {
  assertSubscribesAndEquals(
    arr => arr.findIndex(letter => letter === 'c'),
    ['a', 'b', 'c', 'c'],
    2,
    ['a', 'b'],
    -1
  )
})

Deno.test('findLast()', () => {
  assertSubscribesAndEquals(
    arr => arr.findLast(letter => letter === 'c'),
    ['a', 'b', 'c', 'c'],
    'c',
    ['a', 'b'],
    undefined
  )
})

Deno.test('findLastIndex()', () => {
  assertSubscribesAndEquals(
    arr => arr.findLastIndex(letter => letter === 'c'),
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
    arr => arr.toLocalString(),
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
    arr => arr.every(letter => typeof letter === 'string'),
    ['a', 'c', 'e', 1],
    false,
    ['a', 'c', 'e'],
    true
  )
})

Deno.test('some()', () => {
  assertSubscribesAndEquals(
    arr => arr.some(letter => typeof letter === 'number'),
    ['a', 'c', 'e', 1],
    true,
    ['a', 'c', 'e'],
    false
  )
})

Deno.test('flat()', () => {
  assertSubscribesAndEquals(
    arr => arr.flat().toString(),
    ['a', 'c', 'e', ['nested', 'array']],
    'a,c,e,nested,array',
    ['a', 'c', 'e'],
    'a,c,e'
  )
})

Deno.test('flatMap()', () => {
  assertSubscribesAndEquals(
    arr => arr.flatMap(letter => letter + '2').toString(),
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
    arr => arr.forEach(letter => letter + '2'),
    ['a', 'c', 'e', 'g'],
    undefined,
    ['a', 'c', 'e'],
    undefined
  )
})

Deno.test('reduce()', () => {
  assertSubscribesAndEquals(
    arr => arr.reduce((acc, letter) => acc + letter),
    ['a', 'b', 'c', 'd'],
    'abcd',
    ['a', 'b', 'c'],
    'abc'
  )

  assertSubscribesAndEquals(
    arr => arr.reduce((acc, letter) => acc + letter, '^'),
    ['a', 'b', 'c', 'd'],
    '^abcd',
    ['a', 'b', 'c'],
    '^abc'
  )
})

Deno.test('reduceRight()', () => {
  assertSubscribesAndEquals(
    arr => arr.reduceRight((acc, letter) => acc + letter),
    ['a', 'b', 'c', 'd'],
    'dcba',
    ['a', 'b', 'c'],
    'cba'
  )

  assertSubscribesAndEquals(
    arr => arr.reduceRight((acc, letter) => acc + letter, '^'),
    ['a', 'b', 'c', 'd'],
    '^dcba',
    ['a', 'b', 'c'],
    '^cba'
  )
})

Deno.test('map()', () => {
  assertSubscribesAndEquals(
    arr => arr.map((letter, index) => letter + String(index)).toString(),
    ['a', 'b', 'c', 'd'],
    'a0,b1,c2,d3',
    ['a', 'b', 'c'],
    'a0,b1,c2'
  )
})

# signal-utils

For when your signal has an array or object in it.

## How to install

```sh
npm i @shareup/signal-utils
# or
deno add @shareup/signal-utils
# or
bun add @shareup/signal-utils
```

Or just import it directly in the browser or runtime from esm.sh:

```js
import {
  complextSignal,
  MemoizedArrayOfSignals,
  MemoizedComputeds
} from 'https://esm.sh/@shareup/signal-utils'
```

## What problem does this package solve?

### Problem 1: re-assign value

When you have an array of objects you wish were reative, you put it in a signal:

```ts
const people = signal([{ name: 'Alice' }, { name: 'Fred' })

effect(() => {
  console.debug(`Names: ${people.value.map(p => p.name).join(', ')}`))
})
```

Yet, if you want to add a new item, the signal won’t react from:

```ts
people.push({ name: 'Harmony' }) // 🚨 won’t react
```

Instead you have to do fully re-assign signal’s value to make it react:

```ts
people.value = [{ name: 'Harmony' }, ...people.value] // ✅ reacts
// 'Names: Alice, Fred, Harmony' is logged
```

**This is what `complexSignal` is for.** `complexSignal` proxies all the array methods and does this for you:

```ts
const people = complexSignal([{ name: 'Alice' }, { name: 'Fred' })

effect(() => {
  console.debug(`Names: ${people.value.map(p => p.name).join(', ')}`))
})

people.push({ name: 'Harmony' }) // ✅ reacts
// 'Names: Alice, Fred, Harmony' is logged 💪
```

### Problem 2: deep assignment

Similar to arrays, nested objects aren’t reactive by default:

```ts
const tree = signal({ name: 'Alice', children: [{name: 'Fred'}, {name: 'August'}] })

effect(() => {
  console.debug(`Everyone: ${[tree.value.name, ...tree.children.map(p => p.name)].join(', ')}`))
})
```

If you rename a child, things don’t react:

```ts
tree.children[1].name = 'Harmony' // 🚨 won’t react
```

Instead you have to do fully re-assign signal’s value to make it react:

```ts
tree.value = { name: 'Alice', children: [{name: 'Fred'}, {name: 'Harmony'}] } // ✅ reacts
// 'Everyone: Alice, Fred, Harmony' is logged
```

**This is also what `complexSignal` is for.** `complexSignal` proxies all the object properties and does this for you:

```ts
const people = complexSignal({ name: 'Alice', children: [{name: 'Fred'}, {name: 'August'}] })

effect(() => {
  console.debug(`Everyone: ${[tree.value.name, ...tree.children.map(p => p.name)].join(', ')}`))
})

tree.children[1].name = 'Harmony' // ✅ reacts
// 'Names: Alice, Fred, Harmony' is logged 💪
```

### Problem 3: stable array objects as signals

Now that I have a reactive array of “people,” but if I change the name of a person the signal doesn’t react:

```ts
const fred = people.value.at(1)!
fred.name = 'Again' // 🚨 won’t react
```

**That is what `MemoizedArrayOfSignals` is for.** It makes each element of the array into a `Signal`. Each `Signal` is memoized by an “identifier,” in this case we’ll use the `name` property:

```ts
const people = new MemoizedArrayOfSignals([{ name: 'Alice' }, { name: 'Fred' }, { name: 'Harmony' }], p => p.name)

effect(() => {
  console.debug(`Names: ${people.value.map(p => p.value.name).join(', ')}`))
})

const fred = people.value.at(1)!
fred.name = 'Again' // ✅ reacts
// 'Names: Alice, Again, Harmony' is logged 💪
```

The top-level signal only reacts when *it changes*:

```ts
effect(() => {
  console.debug(`Length: ${people.value.length`))
})

const fred = people.value.at(1)!
fred.name = 'Yet Again' // 🚨 length won’t log, the array itself didn’t change, only Fred

people.push({ name: 'Adam' }) // ✅ reacts
// 'Length: 4' is logged

```

`MemoizedArrayOfSignals` also implements “smart re-assignment”:

```ts
const people = new MemoizedArrayOfSignals([{ name: 'Alice' }, { name: 'Fred' }, { name: 'Harmony' }], p => p.name)

const initialSignals = Array.from(people.value)

people.value = [{ name: 'Alice' }, { name: 'Fred' }, { name: 'Juliet' }]

people.value[0] === initialSignals[0] // true, Alice is the same exact object!
people.value[1] === initialSignals[1] // true, Fred is the same exact object!
people.value[2] !== initialSignals[2] // true, Harmony is gone, Juliet is a new object
```

This is really useful if you get a JSON response from a server, you can just re-assign it and it will smart update any signals where the indentifiers match. Then, in your UI, the parts of the UI using data that didn’t change will sit still and the parts that did change will react. 💪

Other uses for `MemoizedArrayOfSignals`:

* Map 1:1 DOM node to `Signal` to memoized UI elements
* Pass the child `Signal`s down to child UI elements to localize re-rendering / updates to the leaves
* ...

### Problem 4: computed over memoized array of signals

Sometimes you want to map over the memoized array of signals, and you want those `ReadonlySignal`s to have the same object identity stability over time.

**That’s what `MemoizedComputeds` is for.**

```ts
const people = new MemoizedArrayOfSignals([{ name: 'Alice' }, { name: 'Fred' }, { name: 'Harmony' }], p => p.name)
const lowercase = new MemoizedComputeds(people, p => { name: p.value.name.toLowercase() }, people.idFn)

lowercase.value.map(p => p.value.name) // ['alice', 'fred', 'harmony']
```

And it has the same object stability: a `computed()` is only made once for each `Signal` in the original `MemoizedArrayOfSignals`.

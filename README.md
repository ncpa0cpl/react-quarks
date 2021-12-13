# React Quarks

#### Quarks is a simple, lightweight and easy to use state management library for React with full support for Asynchronous State Updates

## Installation

> npm install react-quarks

## Basics

Import the `quark` method from the `rc-quarks` package.

```ts
import { quarks } from "rc-quarks";
```

Create a new Quark

```ts
const counter = quark(0);
```

Access data in the Quark outside React

```ts
const currentCounterValue = counter.get();
```

Update the state of the Quark outside React

```ts
counter.set(1);
```

Use the Quark within a React functional component

```tsx
const MyComponent: React.FC = () => {
  const counterState = counter.use();

  const incrementCounter = () => {
    counterState.set((state) => state + 1);
  };

  return (
    <div>
      <p>Current count: {counterState.get()}</p>

      <button onClick={incrementCounter}>Increment</button>
    </div>
  );
};
```

## Asynchronous Updates

Quarks can also accept asynchronous updates out of the box.

To perform an asynchronous state update simply pass a Promise object to the set method like this:

```ts
const counter = quark(0);

// ...

counter.set(Promise.resolve(1));
```

or a method that returns a Promise:

```ts
const counter = quark(0);

// ...

counter.set(() => Promise.resolve(1));
```

All asynchronous updates are tracked by the Quark instance, and any state update will cancel all the previous non-resolved async updates. With this it's assured that no race-conditions shall occur when using Quarks async updates.

## Gotchas

It's impossible to assign a Function or a Promise object as the Quark value, since any functions or promises will automatically be "unpacked" by the Quark `set()` function (even if they are nested, i.e. `() => () => void`).

If you must have a promise or a function as the value of the Quark then wrap it within a object like so:

```ts
// Function
const quarkWithAFunction = quark({ fn: () => {} });

const someFunction () => {
    // ...
};

quarkWithAFunction.set({ fn: someFunction });

// Promise
const quarkWithAPromise = quark({ p: Promise.resolve() });

const somePromise = new Promise(resolve => {
    // ...
});

quarkWithAPromise.set({ p: somePromise });
```

## Advanced Usage

Quarks are intended to be used with small sets of data, unlike with some others management libraries like for example Redux Quarks are not supposed to hold big objects that contain all of your app global data.

Instead you should try to create a separate Quark for each piece of data you want to store. Ideally Quarks would hold only primitive values and for that the API methods from the 'Basics' section should be sufficient, however with how complex React applications often are sometimes it is impossible. For that reason Quarks implement also some more advanced API methods.

### Dictionaries, Arrays, Selectors and Actions

If your Quark holds arrays of data or dictionaries using just `use`, `get` and `set` can become cumbersome.

### Selectors

Often subscribing to the whole dictionary or array may not be something you want, take for example this Quark:

```ts
const siteSettings = quark({
  title: "My Webpage",
  theme: "dark",
});
```

Here both `title` and `theme` are stored in the same Quark, this means that if we change the value of the `title` all component that "use" this Quark will update, even if all they actually use is the `theme` property (in which case the update is unnecessary). To solve this issue we can use selectors.

Selectors can be used in two ways

1. via the builtin hook `useSelector`
2. or by adding custom selector to the Quark definition

##### With the first approach

```tsx
const selectTitle = (state: QuarkType<typeof siteSettings>) => state.title;

const PageHeader: React.FC = () => {
  const title = siteSettings.useSelector(selectTitle);

  return <h1>{title.get()}</h1>;
};
```

##### With the second approach

First we will need to change how the Quark is defined:

```ts
const siteSettings = quark(
  {
    title: "My Webpage",
    theme: "dark",
  },
  {
    selectors: {
      useTitle(state) {
        return state.title;
      },
    },
  }
);
```

And with this the `useTitle` hook will be added to our Quark.

```tsx
const PageHeader: React.FC = () => {
  const title = siteSettings.useTitle();

  return <h1>{title.get()}</h1>;
};
```

Both of the above solution achieve the same thing - the `PageHeader` component will re-render whenever the title changes but not when the theme changes.

It's worth mentioning that selectors can be used to do much more than that, the returned value from the selector doesn't have to be a property of the Quark state, it can be anything, and the selector will cause the component to update only when that returned value is different from the previous one.

### Selectors with arguments

Selectors can take custom arguments too. It can be done by simply adding arguments to the selector function after the Quark State, like so

```ts
const siteSettings = quark(
  {
    title: "My Webpage",
    theme: "dark",
  },
  {
    selectors: {
      useTitleLetter(state, letterIndex: number) {
        return state.title[letterIndex];
      },
    },
  }
);
```

and then,

```tsx
const PageHeader: React.FC = () => {
  const letter = siteSettings.useTitleLetter(3);

  return <h1>Third letter of the title is: {letter.get()}</h1>;
};
```

### Actions

When the Quark holds an array or a dictionary updating the state with the `set` method may create a boilerplate, for this reason you might want to create a helper functions that will contain all of the repeatable logic in one place. With Actions you can more tightly integrate those helpers with the Quark.

Let's again consider the above `siteSettings` example. If you'd want to update the `title` you'd need to do something like this:

```ts
siteSettings.set((state) => ({ ...state, title: "My new website title" }));
```

All of this for changing one property, and it would only get worse if that property was deeply nested within the `siteSettings`.

To avoid this unnecessary boilerplate you can add actions to the Quark object:

```ts
const siteSettings = quark(
  {
    title: "My Webpage",
    theme: "dark",
  },
  {
    actions: {
      setTitle(state, newTitle: string) {
        return { ...state, title: newTitle };
      },
    },
  }
);
```

And with that the `setTitle` method can be used like so:

```ts
siteSettings.setTitle("My new website title");
```

Actions always take the Quark state as it's first argument, and some other following arguments (these are for the programmer to decide). The method exposed by the Quark will be called the same as the one in the Quark definition but without the first argument of Quark state.

### Side Effects

Sometimes you may want something to happen when the Quark state changes. Quark effects allow for just that.

For example let's say we have a Quark that holds some information that we expect will often change throughout the life of our app and we want to have a timestamp of every change to that information. Instead of adding a new 'Date.now()' on every `set` call we can add an effect like so:

```ts
const data = quark(
  {
    myData: "some data",
    lastUpdated: 0,
  },
  {
    sideEffect: (prevState, newState, set) => {
      if (prevState.myData !== newState.myData) {
        set({ ...newState, lastUpdated: Date.now() });
      }
    },
  }
);
```

Now whenever we change the `myData` property to a different value `myDataEffect` will fire and set the `lastUpdated` property to the current time.

Effect methods take three argument:

- first is the previous state of the Quark
- second is the new or rather current state of the Quark
- third is a `set` function that allows for updating the Quark state

### Middlewares

Middlewares give you the ability to intercept any state updates and modify or prevent them from occurring as well as observe actions sent to the Quarks.

A middleware ought to be a function taking up to 5 arguments:

- arg_0 - `function getState(): T` - method which returns the current Quark state value
- arg_1 - `action: SetStateAction<T, M>` - dispatched value, this is the same as what is provided to the set() function argument
- arg_2 - `function resume(v: SetStateAction<T, M>): void` - this method will resume the standard update flow, value provided to it will be forwarded to the next middleware
- arg_3 - `function set(v: SetStateAction<T, M>): void` - this method allows to break from the standard update flow and set the state immediately bypassing any following middlewares
- arg_4 - `updateType: 'sync' | 'async'` - this argument indicates if the source of the update was synchronous or asynchronous, when first a Promise is provided to the set() method, and after the that promise resolves the value it returned will be dispatched with a type `async`, any other actions will have type `sync`

##### Example

A middleware that will catch any errors a passed callback could throw.

```ts
const catchMiddleware: QuarkMiddleware<number, never> = (
  getState,
  action,
  resume
) => {
  try {
    resume(action);
  } catch (e) {
    console.error("An error occurred during state update!");
  }
};

const counter = quark(0, { middlewares: [catchMiddleware] });

counter.set(() => {
  throw new Error();
}); // Output: 'An error occurred during state update!'
```

#### Extending Quarks with a Middleware

One of the uses of middleware can be to extend the functionality of a Quark.

As an example, imagine you have a quark storing a number, but you'd want to be able to set() it's state with a stringified number. The goal is to have the quark contain always a numeric value, but the set() function to accept both numbers and strings, and not only that, but the action passed to the set() could also be a Promise resolving any of the two, or a callback that returns either.

Middlewares give you this option.

##### Example

```ts
const numParserMiddleware: QuarkMiddleware<number, string> = (
  getState,
  action,
  resume
) => {
  if (typeof action === "string") {
    const num = Number(action);

    if (isNaN(num)) throw new Error("This string is not parsable to a number!");

    return resume(num);
  }

  resume(action);
};

const counter = quark(0, { middlewares: [numParserMiddleware] });

counter.set("2"); // OK
counter.get(); // 2 as a number type

counter.set(() => "123"); // OK
counter.get(); // 123 as a number type

counter.set(() => Promise.resolve("777")); // OK
// ...
counter.get(); // 777 as a number type
```

If you want the middleware to play nicely with TypeScript don't forget to add the `QuarkMiddleware` type to your middleware (as shown in the example). `QuarkMiddleware` is a type that takes in two generics, first is the type of the Quark (as in the type that the get() method should return), and the other is a type that is extending the quark action (ie. the type that can be now additionally accepted in the set() method aside from the actual quark type).

# React Quarks

#### React Quarks is a simple, lightweight and easy to use state management library for React with full support for Asynchronous State Updates

## Table of Contents

1. [Installation](#installation)
2. [Basics](#basics)
3. [Asynchronous Updates](#asynchronous-updates)
   1. [Canceling pending updates](#canceling-pending-updates)
4. [Readonly quark state typings](#readonly-quark-state-typings)
   1. [Example Without Read-only](#example-without-read-only)
   2. [Example With Read-only](#example-with-read-only)
5. [Limitations](#limitations)
   1. [Function as state value](#function-as-state-value)
   2. [Promise as state value](#promise-as-state-value)
6. [Dictionaries, Arrays, Selectors, Actions and Middlewares](#dictionaries-arrays-selectors-actions-and-middlewares)
   1. [Selectors](#selectors)
   2. [Selectors with arguments](#selectors-with-arguments)
   3. [Actions](#actions)
   4. [Side Effects](#side-effects)
   5. [Subscription](#subscription)
   6. [Middlewares](#middlewares)
      1. [Creating a Middleware](#creating-a-middleware)
      2. [Global Middleware](#global-middleware)
      3. [Included Middlewares](#included-middlewares)
         1. [Immer Middleware](#immer-middleware)
         2. [Catch Middleware](#catch-middleware)
         3. [Debug History Middleware](#debug-history-middleware)
7. [SSR](#ssr)

## Installation

> npm install react-quarks

OR

> yarn add react-quarks

## Basics

Import the `quark` method from the `react-quarks` package.

```ts
import { quark } from "react-quarks";
```

**Create a new Quark**

```ts
const counter = quark(0);
```

To declare the quark type you will need to assert the desired type into the initial value (This is a limitation of TypeScript and how the generic types inference works, if you were to specify the type with the `<>` symbols you'd have to also manually define the types for all of the quark selectors, actions and middlewares as well, no inference):

```ts
const listOfNumbers = quark([] as number[]);
// OR
const initialValue: number[] = [];
const listOfNumbers = quark(initialValue);
```

**Access data in the Quark outside React**

```ts
const currentCounterValue = counter.get();
```

**Update the state of the Quark outside React**

With a simple `.set(value)`

```ts
counter.set(counter.get() + 1);
```

With a dispatch function

```ts
counter.set((currentState) => currentState + 1);
```

With a promise

```ts
counter.set(Promise.resolve(counter.get() + 1));
```

With a dispatch function returning a promise

```ts
counter.set((currentState) => Promise.resolve(currentState + 1));
```

**Use the Quark within a React functional component**

```tsx
const MyComponent: React.FC = () => {
  const counterState = counter.use();

  const incrementCounter = () => {
    counterState.set((state) => state + 1);
  };

  return (
    <div>
      <p>Current count: {counterState.value}</p>

      <button onClick={incrementCounter}>Increment</button>
    </div>
  );
};
```

## Asynchronous Updates

Quarks can accept asynchronous updates out of the box.

To perform an asynchronous state update simply pass a Promise object to the set method like this:

```ts
const counter = quark(0);

// ...

counter.set(Promise.resolve(1));
```

or a function that returns a Promise:

```ts
const counter = quark(0);

// ...

counter.set(() => Promise.resolve(1));
```

All asynchronous updates are tracked by the Quark instance, and any state update will cancel all the previous non-resolved async updates. With this it's assured that no race-conditions shall occur when using Quarks async updates.

### Canceling pending updates

In case an asynchronous (or synchronous) update that has been dispatched cannot be finished it can be cancelled by throwing a special class `CancelUpdate`.

```ts
import { CancelUpdate } from "react-quarks";

const data = quark(
  {
    /* some initial data */
  },
  {
    actions: {
      async updateWithNewData(api) {
        try {
          // We request new data from the server
          const result = await fetchNewData();
          // Request was successful, update the state with the result
          return api.setState(result);
        } catch (e) {
          // Request failed, update is cancelled
          throw new CancelUpdate();
        }
      },
    },
  }
);
```

When an action function throws, the quark state update does not happen regardless of what has been thrown, however if the thrown value is not an `CancelUpdate` instance, that event will be logged to the console as an error and propagated up to the initial caller.

## Readonly quark state typings

It is possible to make Quark states have a readonly type when accessed via `.use().value` or `.get()` or a selector. This can help avoid errors that may occur when changing properties of a state, since by design states of Quarks (and React states) are intended to be immutable.

You can enable this feature by extending the global `Quarks.TypeConfig` interface with a `ENABLE_READONLY_STATES` property:

```ts
declare global {
  namespace Quarks {
    interface TypeConfig {
      ENABLE_READONLY_STATES: true;
    }
  }
}
```

### Example Without Read-only

```ts
const myQuark = quark({ foo: { bar: 0 } });
const value = myQuark.get(); // const value: { foo: { bar: number } }

value.foo.bar = 1; // OK, no errors
```

### Example With Read-only

```ts
const myQuark = quark({ foo: { bar: 0 } });
const value = myQuark.get(); // const value: { readonly foo: { readonly bar: number } }

value.foo.bar = 1; // Error: Cannot assign to 'bar' because it is a read-only property.
```

## Limitations

It's impossible to assign a Function or a Promise object as the Quark value, since any functions or promises will automatically be "unpacked" by the Quark `set()` function (even if they are nested, i.e. `() => () => void`).

If you must have a promise or a function as the value of the Quark then wrap it within a object like so:

### Function as state value

```ts
const quarkWithAFunction = quark({ fn: () => {} });

const someFunction () => {
    // ...
};

quarkWithAFunction.set({ fn: someFunction });
```

### Promise as state value

```ts
const quarkWithAPromise = quark({ p: Promise.resolve() });

const somePromise = new Promise((resolve) => {
  // ...
});

quarkWithAPromise.set({ p: somePromise });
```

## Dictionaries, Arrays, Selectors, Actions and Middlewares

If your Quark holds arrays of data or dictionaries using just `use`, `get` and `set` can become cumbersome, to make it easier to use your Quarks you can define actions, selectors and middlewares that will help minimize the boilerplate and ease the development.

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

1. via the builtin hook `select.use`
2. or by adding custom selector to the Quark definition

##### select.use

```tsx
const PageHeader: React.FC = () => {
  const title = siteSettings.select.use((state) => state.title);

  return <h1>{title}</h1>;
};
```

##### custom selector

First we will need to change how the Quark is defined:

```ts
const siteSettings = quark(
  {
    title: "My Webpage",
    theme: "dark",
  },
  {
    selectors: {
      title(state) {
        return state.title;
      },
    },
  }
);
```

And with this the `select.useTitle()` hook will be added to the Quark.

```tsx
// In react components:
const PageHeader: React.FC = () => {
  const title = siteSettings.select.useTitle();

  return <h1>{title}</h1>;
};

// Outside react:
const title = siteSettings.select.title();
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
      titleLetter(state, letterIndex: number) {
        return state.title[letterIndex];
      },
    },
  }
);
```

and then,

```tsx
// In react components:
const PageHeader: React.FC = () => {
  const letter = siteSettings.select.useTitleLetter(2);

  return <h1>Third letter of the title is: {letter}</h1>;
};

// Outside react:
const letter = siteSettings.select.titleLetter(2);
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
      setTitle(api, newTitle: string) {
        const state = api.getState();
        return api.setState({ ...state, title: newTitle });
      },
      // async actions are also possible
      async setThemeAfter1sec(api, theme: string) {
        await new Promise((r) => setTimeout(r, 1000));
        const state = api.getState();
        return api.setState({ ...state, theme });
      },
    },
  }
);
```

And with that the actions can be used like so:

```ts
siteSettings.act.setTitle("My new website title");
siteSettings.act.setThemeAfter1sec("light");
```

Actions always take the Quark state as it's first argument, and optionally some other following arguments. The method exposed by the Quark will be called the same as the one in the Quark definition but without the first argument with Quark state.

### Async Procedures

Async procedures are a special kind of async actions. Procedures are defined with async function generators and can dispatch multiple state updates, moreover they can be interrupted.

```ts
const users = quark(
  {
    loading: false,
    data: [],
    lastError: undefined as Error | undefined,
  },
  {
    procedures: {
      async *fetchUsers(api, auth: string) {
        const initState = api.getState();

        // yielding a value will set it as the new state
        yield { ...initState, loading: true, data: [] };
        try {
          const data = await getUsers(auth);
          return {
            loading: false,
            data,
          };
        } catch (err) {
          // on error set the lastError property
          // and restore the initial data
          return {
            loading: false,
            lastError: err,
            data: initState.data,
          };
        }
      },
    },
  }
);
```

To use it:

```ts
users.act.fetchUsers("Bearer token: 123");
// > { loading: true, data: [] }
// > { loading: false, data: [ ... ] }
```

#### Interruptions

Procedures can be interrupted, this means that if another state update is dispatched while a procedure is running, next yield statement will not cause an update and never return control back to the procedure (nothing after the yield statement will be executed).

```ts
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const q = quark(0, {
  procedures: {
    async *proc() {
      console.log("first yield");
      yield 1;

      console.log("sleeping first time");
      await sleep(100);

      console.log("second yield");
      yield 2;

      await sleep(100);

      console.log("return");
      return 3;
    },
  },
});

q.act.proc();
// > log: first yield
console.log(q.get()); // > log: 1

await sleep(1);
// > log: sleeping first time

q.set(-1);
console.log(q.get()); // > log: -1

await sleep(100);
// > log: second yield
console.log(q.get()); // > log: -1

// Return never happens
```

In the above example, the procedure is interrupted by the `q.set(-1)` call, then when the `yield 2` is reached, it's ignored since a newer update has been dispatched. That same yield is also the last thing that will be executed in that procedure, since any following updates would be ignored anyway.

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

### Subscription

Quarks can also be subscribed to outside of React.

##### Example

```ts
const counter = quark(0);

const subscription = counter.subscribe(
  (currentState: number, cancel: () => void) => {
    // run on Quark state change
  }
);

subscription.cancel(); // Cancels the subscription (equivalent of removeListener in event emitter's)
```

subscribe() method takes a callback as it's argument that's invoked whenever the Quark state changes. That callback can take up to two arguments, the current state of the Quark and a method for cancelling the subscription from within the callback. Subscription can also be cancelled via a method returned returned by the subscribe() as shown in the example.

### Middlewares

Middlewares give you the ability to intercept any state updates and modify or prevent them from occurring as well as observe actions sent to the Quarks.

A middleware is given one object as it's argument with the following properties:

- getState - `() => T` - method which returns the current Quark state value
- action - `SetStateAction<T, M> | QuarkCustomProcedure<T, any[]>` - dispatched value, this is the same as what is provided to the set() function argument or in case of async procedure this is the generator function
- resume - `(v: SetStateAction<T, M> | QuarkCustomProcedure<T, any[]>) => void` - this method will resume the update flow, value provided to it will be forwarded to the next middleware
- set - `(v: SetStateAction<T, M>) => void` - this method allows to break out from the update flow and set the state immediately bypassing any following middlewares
- updateType - `'sync' | 'async' | 'function' | 'async-generator'` - this argument indicates what the source of this update is
- updater - an internal interface used to dispatch state updated

##### Example

A naive middleware that will catch any errors thrown by an action.

```ts
const catchMiddleware: QuarkMiddleware<number, never> = ({
  getState,
  action,
  resume,
  updateType,
}) => {
  if (updateType === "function") {
    return resume((...args) => {
      try {
        return action(...args);
      } catch (e) {
        console.error("An error occurred in the given dispatch function!");
      }
    });
  }
  return resume(action);
};

const counter = quark(0, { middlewares: [catchMiddleware] });

// The action in this case will be a function
counter.set(() => {
  throw new Error();
}); // log: 'An error occurred in the given dispatch function!'
```

#### Creating a Middleware

One of the uses of middleware can be to extend the functionality of a Quark.

As an example, imagine you have a Quark storing a number, but you'd want to be able to set() it's state with a string. The goal is to have the Quark contain always a numeric value, but the set() function to accept both numbers and strings, and not only that, but the action passed to the set() could also be a Promise resolving any of the two, or a callback that returns either.

This can be easily achieved with a right middleware.

##### Example

```ts
const numParserMiddleware: QuarkMiddleware<number, string> = ({
  getState,
  action,
  resume,
}) => {
  // If the action is a string, rather than a number, parse it to a number and continue the update with it
  if (typeof action === "string") {
    const num = Number(action);

    if (isNaN(num)) throw new Error("This string is not parsable to a number!");

    return resume(num);
  }

  // otherwise, continue with the original action
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

If you want the middleware to play nicely with TypeScript don't forget to add the `QuarkMiddleware` type to your middleware (as shown in the example). `QuarkMiddleware` is a type that takes in two generics, first is the type of the Quark (as in the type that the get() method should return), and the other is a type that is extending the Quark action (ie. the type that can be now additionally accepted in the set() method aside from the actual Quark type).

#### Global Middleware

It is also possible to add a global middleware. Global middlewares will be automatically added to all quarks.

To add a global middleware use the `addGlobalQuarkMiddleware` function, or to overwrite all the global middlewares `setGlobalQuarkMiddlewares`. You can also lookup all the current global middlewares with `getGlobalQuarkMiddlewares`.

#### Included Middlewares

`react-quarks` library includes a few Middleware factories to use out of the box.

- **Immer Middleware** - extends the standard function setters of quarks with the [immer library](https://immerjs.github.io/immer/) to allow for updating state by detecting changes made on the current state provided to that functions. When this middleware is used it's possible to update quarks by mutating state properties directly, when within action methods or set functions (ex. `quark.set(current => { current.foo = newValue; return current; }))`)
- **Catch Middleware** - a middleware that provides you a way for catching errors thrown by the set state action callbacks and promises.
- **Debug History Middleware** - a middleware that provides you a way of tracking the Quark update actions and the current state of the Quark.

##### Immer Middleware

```ts
import {
  quark,
  createImmerMiddleware,
  addGlobalQuarkMiddleware,
} from "react-quarks";

addGlobalQuarkMiddleware(createImmerMiddleware({ mapAndSetSupport: true }));

const state = quark(
  { value: "foo" },
  {
    actions: {
      changeValue(api, setTo: string) {
        api.setState((currentState) => {
          currentState.value = setTo;
          return currentState;
        });
      },
    },
  }
);

state.changeValue("bar");
state.get(); // => { value: "bar" }

// Works even with async updates

state.set(async (currentState) => {
  currentState.value = await fetch(/* ... */);
  return currentState;
});
```

##### Catch Middleware

```ts
import { quark, createCatchMiddleware } from "react-quarks";

const catchErrorMiddleware = createCatchMiddleware({
  catch: (e) => {
    console.log("An error has been caught!", e);
    // handle the error
  },
});

const counter = quark(0, {
  middlewares: [catchErrorMiddleware],
});

counter.set(() => {
  throw new Error("Update Failed!");
});
// Output: 'An error has been caught! Error: Update Failed!'
```

**It is recommended for this middleware to be the very first middleware provided in the `middlewares` array.**

##### Debug History Middleware

```ts
import { quark, createDebugHistoryMiddleware } from "react-quarks";

const counterDebugMiddleware = createDebugHistoryMiddleware({
  name: "Counter Quark",
  trace: false, // When enabled a stack trace will be generated for each dispatched set state action
  realTimeLogging: true, // When enabled each set state action will be logged to the console in real time
  useTablePrint: false, // When enabled the history will be printed to the console with a `console.table()`, otherwise `console.log()` will be used
});

const counter = quark(0, {
  middlewares: [counterDebugMiddleware],
});
```

**It is recommended for this middleware to be the last middleware provided in the `middlewares` array.**

When this middleware is used a method in the global scope will be created that will allow the developer to view the quark update history via console.

To show the history, open the console and invoke the method: `printQuarkHistory()`

By default a history of all quarks with this middleware will be logged to the console. You can filter out which Quark is to be shown and how many history entries are to be displayed by specifying the options argument:

```ts
printQuarkHistory({
  name: "Counter Quark", // Name of the specific Quark to show history of. Default is show all
  showLast: 10, // Number of set state action's history entries to show. Default is 16
  useTablePrint: true, // When enabled the history will be printed to the console with a `console.table()`, otherwise `console.log()` will be used
});
```

## SSR

To support Server Side Rendering, Quarks provide a way to serialize them (on the server) and then hydrate (on the client). Each quark that is going to be serialized must have a unique name.

Fist you will need to install `serialize-javascript` on the backend. This package is required for the `serializeQuarks()` function to work.

> npm i serialize-javascript

OR

> yarn add serialize-javascript

Then you can use it as follows:

```tsx
// Server Side
import Express from "express";
import { renderToString } from "react-dom/server";
import { quark, serializeQuarks } from "react-quarks";

const serverHeader = quark("Hello World", { name: "header" });

const Home = () => {
  const header = serverHeader.use();

  return <h1>{header.value}</h1>;
};

const app = Express();

app.get("/", (req, resp) => {
  const html = renderToString(<Home />);
  const serialized = serializeQuarks();

  return `
    <html>
      <head>
        <script>
          window.__PRELOADED_STATE__ = ${serialized}; // quotation marks are already included
        </script>
      </head>
      <body>
        <div id="root">
          ${html}
        <div>
      </body>
    </html>
  `;
});

app.listen(80);

// Client side
import ReactDOM from "react-dom";
import { quark, hydrateQuarks } from "react-quarks";

const clientHeader = quark("", { name: "header" }); // the same name as in the `serverHeader`

const Home = () => {
  const header = clientHeader.use();

  return <h1>{header.value}</h1>;
};

if (window.__PRELOADED_STATE__) {
  hydrateQuarks(window.__PRELOADED_STATE__);
}

// Serialized data is not needed after hydration
delete window.__PRELOADED_STATE__;

ReactDOM.hydrate(<Home />, document.getElementById("root"));
```

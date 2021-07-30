# React Particles
#### Quarks is a simple, lightweight and easy to use state management library for React.

## Installation

> npm install react-particles

## Basics

Import the `quark` method from the `react-particles` package.

```ts
import { quark } from "react-particles";
```

Create a new quark
```ts
const counter = quark(0);
```

Access data in the quark outside React
```ts
const currentCounterValue = counter.get();
```

Update the state of the quark outside React
```ts
counter.set(1);
```

Use the quark within a React functional component
```tsx
const MyComponent: React.FC = () => {
    const counterState = counter.use();

    const incrementCounter = () => {
        counterState.set(state => state + 1);
    }

    return (
        <div>
            <p>Current count: {counterState.get()}</p>

            <button onClick={incrementCounter}>Increment</button>
        </div>
    )
}
```

## Advanced Usage

Quarks are intended to be used with small sets of data, unlike with some others management libraries like for example Redux quarks are not supposed to hold big objects that contain all of your app global data.

Instead you should try to create a separate quark for each piece of data you want to store. Ideally quarks would hold only primitive values and for that the API methods from the 'Basics' section should be sufficient, however with how complex React applications often are this is impossible in a lot of cases. For that reason quarks implement also some more advanced API methods.

### Dictionaries, Arrays, Selectors and Actions

If your quark holds arrays of data or dictionaries using just `use`, `get` and `set` can become cumbersome.

#### Selectors

Often subscribing to the whole dictionary or array may not be something you want, take for example this quark:

```ts
const siteSettings = quark({
    title: "My Webpage",
    theme: "dark"
});
```

Here both `title` and `theme` are stored in the same quark, this means that if we change the value of the `title` all component that "use" this quark will update, even if all they actually use is the `theme` property (in which case the update is unnecessary). To solve this issue we can use selectors.

Selectors can be used in two ways
1. via the builtin hook `useSelector`
2. or by adding custom selector to the quark definition
  
##### Using the first approach:

```tsx
const selectTitle = (state: QuarkType<typeof siteSettings>) => state.title;

const PageHeader: React.FC = () => {
    const title = siteSettings.useSelector(selectTitle);

    return (
        <h1>{title.get()}</h1>
    )
}
```

##### Using the second approach:

First we will need to change how the quark is defined:

```ts
const siteSettings = quark({
    title: "My Webpage",
    theme: "dark"
}, {
    selectors: {
        useTitle(state) {
            return state.title;
        }
    }
});
```

And with this the `useTitle` hook will be added to our quark.

```tsx
const PageHeader: React.FC = () => {
    const title = siteSettings.useTitle();

    return (
        <h1>{title.get()}</h1>
    )
}
```

Both of the above solution achieve the same thing - the `PageHeader` component will re-render whenever the title changes but not when the theme changes.

It's worth mentioning that selectors can be used to do much more than that, the returned value from the selector doesn't have to be a property of the quark state, it can be anything, and the selector will cause the component to update only when that returned value is different from the previous one.

#### Actions

When the quark holds an array or a dictionary updating the state with the `set` method may create a boilerplate, for this reason you might want to create a helper functions that will contain all of the repeatable logic in one place. With Actions you can more tightly integrate those helpers with the quark.

Let's again consider the above `siteSettings` example. If you'd want to update the `title` you'd need to do something like this:

```ts
siteSettings.set(state => ({...state, title: "My new website title"}));
```

All of this for changing one property, and it would only get worse if that property was deeply nested within the `siteSettings`.

To avoid this unnecessary boilerplate you can add actions to the quark object:

```ts
const siteSettings = quark({
    title: "My Webpage",
    theme: "dark"
}, {
    actions: {
        setTitle(state, newTitle: string) {
            return {...state, title: newTitle};
        }
    }
});
```

And with that the `setTitle` method can be used like so:

```ts
siteSettings.setTitle("My new website title")
```

Actions always take the quark state as it's first argument, and some other following arguments (these are for the programmer to decide). The method exposed by the quark will be called the same as the one in the quark definition but without the first argument of quark state.

### Side Effects

Sometimes you may want something to happen when the quark state changes. Quark effects allow for just that.

For example let's say we have a quark that holds some information that we expect will often change throughout the life of our app and we want to have a timestamp of every change to that information. Instead of adding a new 'Date.now()' on every `set` call we can add an effect like so:

```ts
const data = quark({
    myData: "some data",
    lastUpdated: 0,
}, {}, {
    myDataEffect(prevState, newState, actions) {
        if(prevState.myData !== newState.myData) {
            actions.set({...newState, lastUpdated: Date.now()});
        }
    }
});
```

Now whenever we change the `myData` property to a different value `myDataEffect` will fire and set the `lastUpdated` property to the current time.

Effect methods take three argument:

* first is the previous state of the quark
* second is the new or rather current state of the quark
* third is an object containing all of the quark actions, this includes the `set` method and the custom actions

Keep in mind that if you pass the same reference to the quark `set` method like here: 
```ts
data.set(state => {
    state.myData = "new data";
    return state;
})
```
then the first and second arguments are going to be the same object which will make it impossible to tell whether any property had changed.
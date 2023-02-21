## Transition state
Transition state is a short-lived but high frequency updating state for tracking changes to a polygon or multipoint shape (e.g. a bounding box).

For example, if you were implementing a drag to move a shape you could use a transition to track the changes from the start of the drag to the end of the drag.

Since these update at high frequency - you might not want to use an internal state mechanism (like React state) and instead manually mutate the DOM on a frame change or similar. You may also be drawing these changes on an HTML canvas.

Transitions are short-lived and are made up of the following:

* Transition start
* Transition actions
* Transition results

### Quick start

When you start a transition, you have to pass in some options
to give the state some idea of what you are transitioning and what you are not transitioning.

Let's create a transition for a simple drag to move position.

```js
const store = transitionState();
const { startTransition, translate } = store.getState();


startTransition({
  // A simple box.
  points: [[0, 0], [0, 100], [100, 100], [100, 0]],
  // Which indexes are transitioning (e.g. being dragged)
  activePoints: [0, 1, 2, 3],
  // Where did the interaction start?
  origin: [64, 20],
});

translate([84, 20]); // from a mouse event.


// The points have moved 20px -> to the right
const { points } = store.getState();
expect(points).toEqual(
  [[20, 0], [20, 100], [120, 100], [120, 0]]
);
```

We provided the starting conditions, with all the points
we want to render. And then the active points - which index
the points.

One important concept is that the functions:
- `translate()`
- `transform()`
- `scale()`
- `rotate()`
- `scaleAndRotate()`

They are no accumulative, they are like previewing what it would be like _if_ that operation was made on your data - with enough information to render a "ghost" or temporary transition state.

For example:

```js
// After these three commands, the points are still 20px ->
translate([104, 20]);
translate([1004, 2000]);
translate([84, 20]); 

// As though you had only done this:
translate([84, 20]);
```

This is because the final mutation of the points - in your data - will be when the transition is complete. This is the last interaction the user made, maybe the last position of their mouse or key combination.

```js
const store = transitionState();
const { finishTransition } = store.getState();
// ...

const result = finishTransition();
```

Once you have this trigger to finish a transition, you will get a result back. The result will have the following:

- `points` - updated set of points, useful if you provided real analogous points to the transition
- `activePoints` - the active points you input (not indexed)
- `rotation` - rotation applied in radians
- `origin` - where the origin that you input
- `originPoint` - origin in relation to your data (see pointScale below)

Additionally, you will also get back the final transformations:

- `scale`: `{x, y}` of the scale
- `translation`: `{x, y}` of the translation
- `skew`: `{x, y}` of the skew
- `matrix`: a homogeneous [2D transformation matrix](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix)
- `apply(point) -> point` - A function you can pass your points through to get the final points. This can be useful if you used a bounding box for the input, but have many points (like GeoJSON shape) that need to be translated. You could also feed in a simplified representation of a complex shape and then use this `apply()` on many thousands of points.

You may render a UI like this (pseudo-code):

```js
const store = transitionState();
const { startTransition, finishTransition, translate } = store.getState();

box.on('dragstart', (e) => {
  startTransition({ 
    points: getBoxPoints(), 
    origin: [e.pageX, e.pageY] 
  });
  hideBox(); // hide your box.
});

box.on('mousemove', (e) => {
  translate([e.pageX, e.pageY]);
});

box.on('dragend', () => {
  const result = finishTransition();
  updateBox(result.points); // some function to update your box
  hideTempBox(); // hide the temp box
  showBox(); // and show it
});

store.subscribe((state) => {
  if (state.isTransitioning) {
    updateTempBox(state.points); // high-freq update to temp box.
  }
});
```

Splitting this into its own temporary state allows you to create analogs during high frequency transitions. E.g. a bounding box around a complex shape, you could then apply scaling and translate UI and apply them to the points at the end. Or if you wanted to apply warping, you could create a dense grid of points and during a transition only calculate the movement of those points - before applying a pixel transformation.

### Design goals

This transition API is not yet complete - and needs further testing. However, the goals of this implementation are the following:

- Maintain good and clear documentation
- Framework-less implementation
- Support for 2d transforms of points
- Enable single or multipoint editing and transforms
- Support multitouch-style scale/zoom transformations from multiple targets
- Support performant snap-to-grid
- Support snap-to-rotation
- Deep integration with `svg-selector-editor` to make SVG editing simple

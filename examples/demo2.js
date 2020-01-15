// var State = require('../src/index');
var State = window.State = require('../dist/controls-state.min.js');

var state = window.state = new State({
  // It can try to infer types:
  background: '#ff0000',

  // You can instantiate controls manually to provide more configuration
  alpha: State.Slider(0.5, { min: 0, max: 1, step: 0.01 }),

  // Objects result in nested sections:
  shape: {
    width: 640,
    height: 480
  }
});

console.log('alpha:', state.alpha); // -> 0.5
console.log('width:', state.shape.width); // -> 640
console.log('shape.height:', state.shape.height); // -> 480

// Via the $path property, you can access the underlying objects
// console.log(state.$path.shape.width);
// -> Slider {
//      type: 'slider',
//      name: 'width',
//      min: 0,
//      max: 640,
//      step: 1 }

// Subscribing to batched events:
state.$onChanges(function (changes) {
  Object.keys(changes).map(path => console.log(path + ':', {
    name: changes[path].name,
    path: changes[path].path,
    fullPath: changes[path].fullPath,
    oldValue: changes[path].oldValue,
    value: changes[path].value
  }));
  // Once the updates below are applied, on the next tick this
  // function will be called with changes:
  //
  // changes = {
  //  'shape.width': {
  //    name: 'width',
  //    path: 'shape.width',
  //    fullPath: 'shape.width',
  //    oldValue: 480,
  //    value: 500
  //  },
  //  'shape.height': {
  //    name: 'height',
  //    path: 'shape.height',
  //    fullPath: 'shape.height',
  //    oldValue: 480,
  //    value: 500
  //  }
  // }
});

// Multiple changes in a single tick get batched and reported
// as one "changes" event
state.shape.width = 400;
state.shape.height = 400;
state.shape.height = 500;

// Magic cats — characters. This module is only a hub: each family of characters lives in its own
// file, and scenes keep importing everything from here under the same names.
//   cat.js     CAT_KINDS, Cat
//   bundle.js  drawBundle, drawLooseBundle
//   people.js  KIDS, Kid
//   birds.js   BIRD_COLORS, Bird, drawFirefly, drawButterfly

export { CAT_KINDS, Cat } from './cat.js';
export { drawBundle, drawLooseBundle } from './bundle.js';
export { KIDS, Kid } from './people.js';
export { BIRD_COLORS, Bird, drawFirefly, drawButterfly } from './birds.js';

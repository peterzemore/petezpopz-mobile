// PetezPopz — Custom Entry Point
//
// IMPORTANT: This file MUST use require(), NOT import.
// ES module `import` statements are hoisted by Babel/Metro to the top of the
// compiled file — before any synchronous code runs — which defeats the purpose
// of patching before expo-router loads. require() executes in-order.
//
// Problem: React Native 0.79+ / Hermes defines Event phase constants
// (NONE, CAPTURING_PHASE, AT_TARGET, BUBBLING_PHASE) as non-writable on
// Event.prototype. The bundled XHR polyfill tries to assign them as instance
// properties in its Event constructor, which throws in Hermes strict mode:
//   "TypeError: Cannot assign to read-only property 'NONE'"
// This crashes every single fetch() call, including all Shopify API requests.
//
// Fix: make the constants writable+configurable BEFORE expo-router/entry loads.

'use strict';

// ── Step 1: Patch Event.prototype constants ───────────────────────────────────
var EVENT_PHASE_KEYS = ['NONE', 'CAPTURING_PHASE', 'AT_TARGET', 'BUBBLING_PHASE'];
var EVENT_PHASE_VALUES = [0, 1, 2, 3];

if (typeof Event !== 'undefined' && Event.prototype) {
  for (var i = 0; i < EVENT_PHASE_KEYS.length; i++) {
    var key = EVENT_PHASE_KEYS[i];
    var val = EVENT_PHASE_VALUES[i];
    var desc = Object.getOwnPropertyDescriptor(Event.prototype, key);
    if (desc) {
      try {
        Object.defineProperty(Event.prototype, key, {
          value: val,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch (_err) {
        // If defineProperty itself is blocked, try the nuclear option:
        // delete the property so instance assignment doesn't throw.
        try { delete Event.prototype[key]; } catch (_) {}
      }
    }
  }
}

// ── Step 2: Load the app (must be require, not import) ────────────────────────
require('expo-router/entry');

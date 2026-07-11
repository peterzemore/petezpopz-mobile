// PetezPopz — Runtime Polyfills
//
// WHY THIS FILE EXISTS:
// React Native 0.79+ with Hermes defines Event phase constants (NONE, CAPTURING_PHASE,
// AT_TARGET, BUBBLING_PHASE) as non-writable, non-configurable properties on Event.prototype.
// The built-in XHR/fetch polyfill tries to assign them as instance properties on new Event()
// objects, which Hermes rejects in strict mode with:
//   "TypeError: Cannot assign to read-only property 'NONE'"
//
// This crashes every fetch() call, including Shopify API requests.
// Fix: redefine those 4 constants as writable + configurable so the assignment succeeds.

const EVENT_PHASE_CONSTANTS: Record<string, number> = {
  NONE: 0,
  CAPTURING_PHASE: 1,
  AT_TARGET: 2,
  BUBBLING_PHASE: 3,
};

if (typeof Event !== 'undefined' && Event.prototype) {
  Object.entries(EVENT_PHASE_CONSTANTS).forEach(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(Event.prototype, key);
    // Only patch if the property exists and is non-writable/non-configurable
    if (descriptor && (!descriptor.writable || !descriptor.configurable)) {
      try {
        Object.defineProperty(Event.prototype, key, {
          value,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch {
        // Silently ignore if the runtime prevents even defineProperty
      }
    }
  });
}

export {};

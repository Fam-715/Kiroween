import "@testing-library/jest-dom/vitest";

// Node 25+ ships its own experimental Web Storage globals (localStorage and
// sessionStorage). Without --localstorage-file, Node's localStorage is
// undefined or throws, and it shadows the jsdom implementation that Vitest
// would otherwise copy onto globalThis. Point both globals back at jsdom's
// storage so tests behave the same on Node 20 through 26.
type JsdomGlobal = { jsdom?: { window: Window } };
const jsdomWindow = (globalThis as unknown as JsdomGlobal).jsdom?.window;

if (jsdomWindow) {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: true,
      get: () => jsdomWindow[name],
    });
  }
}

// jsdom does not implement matchMedia; Framer Motion's useReducedMotion
// (and any prefers-reduced-motion checks) needs it to exist.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
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

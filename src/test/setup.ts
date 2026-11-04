import "@testing-library/jest-dom/vitest";

// Server-side code (netlify/) runs its tests in the node environment, with no window to prepare.
if (typeof window !== "undefined") {
  // Recent Node versions shadow jsdom's storage with one that is undefined unless started with a file flag.
  const memoryStorage = (): Storage => {
    const items = new Map<string, string>();
    return {
      get length() {
        return items.size;
      },
      clear: () => items.clear(),
      getItem: (key) => items.get(key) ?? null,
      key: (index) => [...items.keys()][index] ?? null,
      removeItem: (key) => void items.delete(key),
      setItem: (key, value) => void items.set(key, String(value)),
    };
  };

  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(window, name, { configurable: true, value: memoryStorage() });
  }

  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

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
      dispatchEvent: () => {},
    }),
  });
}

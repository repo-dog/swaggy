import "@testing-library/jest-dom/vitest";

// jsdom lacks ResizeObserver and scrollIntoView, which cmdk / Radix dialog use.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
// jsdom (this version) lacks Blob/File.prototype.text, used to read an uploaded profiles
// file. FileReader is implemented, so back text() with it to match browser behavior.
if (typeof Blob !== "undefined" && !Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsText(this);
    });
  };
}
// jsdom lacks matchMedia, which the theme resolver uses. Default: OS prefers light.
if (!("matchMedia" in globalThis)) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  })) as unknown as typeof globalThis.matchMedia;
}

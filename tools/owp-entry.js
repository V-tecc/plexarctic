/* Polyfills for older TV browsers (Chromium 85 on 2022 Samsung TVs) */
if (!Promise.withResolvers) {
  Promise.withResolvers = function () { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
}
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', { value: function (n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; return n < 0 || n >= this.length ? undefined : this[n]; }, writable: true, configurable: true });
}
if (!String.prototype.at) {
  Object.defineProperty(String.prototype, 'at', { value: function (n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; return n < 0 || n >= this.length ? undefined : this[n]; }, writable: true, configurable: true });
}
export * from './openwatchparty/sdk/typescript/src/index.ts';

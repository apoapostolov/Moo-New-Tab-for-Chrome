// Chrome 120+ supports the Promise APIs used by Moo. Keep the same namespace as Firefox.
if (!globalThis.browser && globalThis.chrome?.runtime?.id) {
  globalThis.browser = globalThis.chrome;
}

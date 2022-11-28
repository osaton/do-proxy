export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'miniflare',
  testEnvironmentOptions: {
    // Miniflare doesn't yet support the `main` field in `wrangler.toml` so we
    // need to explicitly tell it where our built worker is. We also need to
    // explicitly mark it as an ES module.
    scriptPath: 'dist-worker/index.mjs',
    modules: true,
  },
};

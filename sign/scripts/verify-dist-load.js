'use strict';

const entries = ['../dist/main/index.js', '../dist/post/index.js'];

for (const entry of entries) {
  try {
    require(entry);
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      console.error(`Dist bundle failed to load (${entry}):`, err.message);
      process.exit(1);
    }
  }
}

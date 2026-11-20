// L1 API tests (Design §8.3). Need: running app (`YOUTUBE_FAKE=1 npm run dev`), keys in .env.local, `npm run seed`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/api/**/*.test.ts'], environment: 'node', testTimeout: 20_000, fileParallelism: false },
});

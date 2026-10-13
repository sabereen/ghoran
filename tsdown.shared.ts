import type { UserConfig } from 'tsdown'

/** Keep the published ESM and declaration paths stable across all packages. */
export const libraryConfig: UserConfig = {
  format: 'esm',
  platform: 'neutral',
  target: 'es2018',
  dts: true,
  clean: true,
  deps: { neverBundle: [/^@ghoran\//] },
  outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
}

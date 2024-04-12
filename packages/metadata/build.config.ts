import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['./src/index', './src/constants'],

  // Generates .d.ts declaration file
  declaration: true,
})

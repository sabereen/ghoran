import {
  defineConfig,
  presetWind3,
  presetIcons,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [presetWind3({}), presetIcons({})],
  transformers: [transformerVariantGroup({ separators: [':'] })],
  shortcuts: [[/^s-(.*)/, ([_, v]) => `w-${v} h-${v}`]],
})

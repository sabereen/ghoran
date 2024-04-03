import postcssRTLCSS from 'postcss-rtlcss'
import { Mode, Source } from 'postcss-rtlcss/options'

export default {
  plugins: [
    postcssRTLCSS({
      mode: Mode.combined,
      source: Source.ltr,
    }),
  ],
}

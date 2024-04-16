import { QuranTextType } from '../../src/types'
import { texts as normalTexts } from '../extract'
import { fixText } from './word-offset'

export const fixedTexts = { ...normalTexts }

function fix(hafsLike: QuranTextType, imlaLike: QuranTextType) {
  ;[fixedTexts[hafsLike], fixedTexts[imlaLike]] = fixText(
    fixedTexts[hafsLike],
    fixedTexts[imlaLike],
  )
}

fix('hafs', 'imla')
fix('hafs', 'tanzil-simple-min')
fix('hafs', 'tanzil-simple-clean')
fix('hafs-v13', 'imla')
fix('hafs-v13', 'tanzil-simple-min')
fix('hafs-v13', 'tanzil-simple-clean')

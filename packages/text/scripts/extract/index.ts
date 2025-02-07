import fs from 'fs-extra'
import { copyQuranTexts as readQuranText } from './copy-text'
import { extractHafsV13 } from './extract-hafs-v13'
import { extractHafsV22 } from './extract-hafs-v22'
import { extractTanzilText } from './extract-tanzil'
import { QuranTextType } from '../../src/types'
import { extractQPCTextV2 } from './extract-qpc-v2'

export const texts: Record<QuranTextType, string[]> = {
  'hafs-v13': await extractHafsV13(),
  hafs: await extractHafsV22(),
  'tanzil-simple-clean': extractTanzilText('simple-clean'),
  'tanzil-simple-min': extractTanzilText('simple-min'),
  imla: readQuranText('quran-text-emla'),
  'qpc-v1': readQuranText('qpc-v1'),
  'qpc-v2': extractQPCTextV2('qpc-v2'),
}

// موارد زیر آماده است، ولی چون فعلا لازمشان نداریم از آن‌ها استفاده نمی‌کنیم
// extractTanzilText('simple')
// extractTanzilText('simple-plain')

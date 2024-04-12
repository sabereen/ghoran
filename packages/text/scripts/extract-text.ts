import { extractHafsV13 } from './extract-hafs-v13'
import { extractHafsV22 } from './extract-hafs-v22'
import { extractTanzilText } from './extract-tanzil'

extractHafsV13()
extractHafsV22()

extractTanzilText('simple')
extractTanzilText('simple-plain')
extractTanzilText('simple-min')
extractTanzilText('simple-clean')

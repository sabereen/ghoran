import { QuranTextType } from './types'

function importText(type: QuranTextType): Promise<{ default: string[] }> {
  switch (type) {
    case 'clean':
      return import('../text/quran-text-clean.json')
    case 'simple-min':
      return import('../text/quran-text-simple-min.json')
    case 'imla':
      return import('../text/quran-text-emla.json')
    case 'hafs':
      return import('../text/quran-text-hafs-v22.json')
    case 'hafs-v13':
      return import('../text/quran-text-hafs-v13.json')
  }
}

export function loadText(type: QuranTextType) {
  return importText(type).then((module) => module.default)
}

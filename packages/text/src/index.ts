import { QuranTextType } from './types'

function importText(type: QuranTextType): Promise<{ default: string[] }> {
  switch (type) {
    case 'clean':
      return import('../json/quran-text-clean.json')
    case 'simple-min':
      return import('../json/quran-text-simple-min.json')
    case 'imla':
      return import('../json/quran-text-emla.json')
    case 'hafs':
      return import('../json/quran-text-hafs-v22.json')
    case 'hafs-v13':
      return import('../json/quran-text-hafs-v13.json')
  }
}

export function loadText(type: QuranTextType) {
  return importText(type).then((module) => module.default)
}

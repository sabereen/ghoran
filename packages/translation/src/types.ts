import { Translations } from './generated-types'

export type Language = keyof Translations

export type Translators<L extends Language> = Translations[L]

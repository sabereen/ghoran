import { vi } from 'vitest'
import { searchBinaryForAyah } from '@ghoran/utils'
import { SurahTuple, pageList, surahList } from '@ghoran/metadata'

describe('binary search for ayah', () => {
  test('it should search for a page', () => {
    expect(searchBinaryForAyah(pageList, -1)).toBe(-1)

    expect(pageList[0]).toBe(0)
    expect(searchBinaryForAyah(pageList, 0)).toBe(0)

    expect(pageList[1]).toBe(7)
    expect(searchBinaryForAyah(pageList, 7)).toBe(1)

    expect(searchBinaryForAyah(pageList, 10)).toBe(1)
  })

  test('it should search with custom function', () => {
    const getAyahIndex = vi.fn((surah: SurahTuple) => surah[0])

    expect(searchBinaryForAyah(surahList, 12, getAyahIndex)).toBe(1)
    expect(getAyahIndex.mock.calls.length).toBeLessThanOrEqual(
      Math.ceil(Math.log2(surahList.length)),
    )

    expect(searchBinaryForAyah(surahList, 0, getAyahIndex)).toBe(0)
    expect(searchBinaryForAyah(surahList, 7, getAyahIndex)).toBe(1)
  })
})

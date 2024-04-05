import { searchBinary } from '../../utils/src/binary-search'

describe('binary search', () => {
  test('it should search in simple arrays', () => {
    const sortedArray = [1, 2, 2, 8, 43, 50, 51]
    expect(searchBinary(sortedArray, 8)).toBe(3)
    expect(searchBinary(sortedArray, 0)).toBe(-1)
    expect(searchBinary(sortedArray, 52)).toBe(-1)
  })
})

export function searchBinaryForAyah<T>(
  sortedList: T[],
  valueToFind: number,
  getValueToCompare: (item: T, index: number) => number = (item) => +item,
  start = 0,
  end = sortedList.length - 1,
): number {
  if (end - start < 0) return end
  const index = start + Math.floor((end - start) / 2)
  const currentValue = getValueToCompare(sortedList[index], index)
  if (valueToFind === currentValue) return index
  if (currentValue < valueToFind) {
    return searchBinaryForAyah(
      sortedList,
      valueToFind,
      getValueToCompare,
      index + 1,
      end,
    )
  }
  return searchBinaryForAyah(
    sortedList,
    valueToFind,
    getValueToCompare,
    start,
    index - 1,
  )
}

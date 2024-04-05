export function searchBinary<T>(
  sortedList: T[],
  valueToFind: number,
  getValueToCompare: (item: T, index: number) => number = (item) => +item,
  start = 0,
  end = sortedList.length,
): number {
  if (end - start <= 0) return -1
  const index = start + Math.floor((end - start) / 2)
  const currentValue = getValueToCompare(sortedList[index], index)
  if (valueToFind === currentValue) return index
  if (currentValue < valueToFind) {
    return searchBinary(
      sortedList,
      valueToFind,
      getValueToCompare,
      start,
      index,
    )
  }
  return searchBinary(
    sortedList,
    valueToFind,
    getValueToCompare,
    index + 1,
    end,
  )
}

import { SajdahTuple } from './types'

// #region sajdahListBySurahNumber
/** لیست آیات سجده دار */
export const sajdahListBySurahNumber: SajdahTuple[] = [
  [7, 206, false],
  [13, 15, false],
  [16, 50, false],
  [17, 109, false],
  [19, 58, false],
  [22, 18, false],
  [22, 77, false],
  [25, 60, false],
  [27, 26, false],
  [32, 15, true],
  [38, 24, false],
  [41, 38, true],
  [53, 62, true],
  [84, 21, false],
  [96, 19, true],
]
// #endregion sajdahListBySurahNumber

/** نگاشتی از اندیس آیات سجده دار به اینکه آیا سجده واجب است یا نه */
export const sajdahMap: Record<number, boolean> = {
  '1159': false,
  '1721': false,
  '1950': false,
  '2137': false,
  '2307': false,
  '2612': false,
  '2671': false,
  '2914': false,
  '3184': false,
  '3517': true,
  '3993': false,
  '4255': true,
  '4845': true,
  '5904': false,
  '6124': true,
}

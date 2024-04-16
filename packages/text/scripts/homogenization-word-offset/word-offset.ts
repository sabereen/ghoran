/**
 * متنی را می‌گیرد و بر اساس کاراکتر فاصله آن را تبدیل به آرایه می‌کند
 * @param text - متن
 */
function splitBySpace(text: string) {
  return (text || '').split(' ')
}

/**
 * متنی را می‌گیرد و حرف به حرف جدا می‌کند
 *
 * حروفی که ناسازگاری زیادی در آیات مختلف دارند فیلتر می‌شوند
 * و در آرایه‌ی خروجی برگردانده نخواهند شد
 * البته همچنان هم در ۸۰ آیه قرآن ناسازگاری وجود دارد
 * @param text - متن
 */
export function splitLetters(text: string) {
  const matchResult = (text || '').match(/\p{L}/gu)
  const matchResultAsArray = Array.from(matchResult || [])
  const finalResult = matchResultAsArray.filter(
    (item) => !item.match(/[وۛـۖؤءۗإآٱأائىۜیۚيۥۦ]/),
  )
  return finalResult
}

// آیاتی را که بین دو رسم الخط یکسان نیستند پیدا می‌کند و اندیسشان را بر می‌گرداند
export function findIncompatibleAyahs(
  hafsLikeText: string[],
  imlaLikeText: string[],
) {
  const hafsWordCounts = hafsLikeText.map(splitBySpace)
  const imlaWordCounts = imlaLikeText.map(splitBySpace)
  const errors = []
  for (let i = 0; i < hafsWordCounts.length; i++) {
    if (hafsWordCounts[i].length !== imlaWordCounts[i].length) errors.push(i)
  }
  return errors
}

/**
 * متن قرآن را در دو رسم الخط مختلف می‌گیرد و از نظر تعداد کلمات هر آیه
 * آن دو را یکسان سازی می‌کند و در قالب دو آرایه‌ی جدید بر می‌گرداند.
 * @param hafsLikeText - رسم الخطی که شبیه عثمان طه است
 * @param imlaLikeText - رسم الخطی که شبیه رسم املاء است
 */
export function fixText(
  hafsLikeText: string[],
  imlaLikeText: string[],
): [fixedHafsLikeText: string[], fixedImlaLikeText: string[]] {
  // بررسی می‌کند که آیا متن یک کلمه عثمان طه با رسم الاملا تعداد کاراکتر یکسانی دارد؟
  function match(hafsWord: string, imlaWord: string) {
    return splitLetters(hafsWord).length === splitLetters(imlaWord).length
  }

  /** اندیس یک آیه را می‌گیرد و سعی می‌کند آن را بین دو رسم الخط اصلاح کند */
  function fixOneAyah(index: number) {
    const nbsp = '\u00A0'
    const hafsToSplit = hafsLikeText[index]
    const imlaToSplit = imlaLikeText[index]
      .replace(/ ۩/g, nbsp + '۩')
      .replace(/ ([ۖۛۗۜۚ])/g, nbsp + '$1')
      .replace(/۞ /g, '۞' + nbsp)
    const hafs = splitBySpace(hafsToSplit)
    const imla = splitBySpace(imlaToSplit)
    const length = Math.max(hafs.length, imla.length)

    for (let i = 0; i < length; i++) {
      if (!hafs[i] || !imla[i]) continue
      if (!match(hafs[i], imla[i])) {
        const hafsLength = splitLetters(hafs[i]).length
        const imlaLength = splitLetters(imla[i]).length
        if (imlaLength < hafsLength) {
          imla[i] = imla[i] + nbsp + imla[i + 1]
          imla.splice(i + 1, 1)
        }
        // فقط ۵ مورد این شکلی داریم
        if (imlaLength > hafsLength) {
          // فقط دو مورد این شکلی داریم
          if (hafs[i].includes('ٱلّ')) continue
          // یک مورد این شکلی در رسم الخط کم‌علامت داریم
          if (hafs[i].includes('نُـۨجِي')) continue
          hafs[i] = hafs[i] + nbsp + hafs[i + 1]
          hafs.splice(i + 1, 1)
        }
      }
    }

    return { hafs, imla }
  }

  /** تمام آیات بین دو رسم الخط را اصلاح می‌کند و آرایه‌ای جدید بر می‌گرداند */
  function fix(): [string[], string[]] {
    const fixedImlaText = [...imlaLikeText]
    const fixedHafsText = [...hafsLikeText]
    const incompatibleAyahs = findIncompatibleAyahs(hafsLikeText, imlaLikeText)

    incompatibleAyahs.forEach((index) => {
      const fixResult = fixOneAyah(index)
      fixedHafsText[index] = fixResult.hafs.join(' ')
      fixedImlaText[index] = fixResult.imla.join(' ')
    })

    return [fixedHafsText, fixedImlaText]
  }

  return fix()
}

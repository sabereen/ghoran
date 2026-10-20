# Quran resources

This page collects Quran resources useful to developers. Depending on their licenses and project needs, some may gradually be integrated into Ghoran.

[[toc]]

## Quran metadata

### Tanzil

https://tanzil.net/docs/quran_metadata

Data about chapters, pages, juz and hizb divisions, prostrations, and more. Our metadata packages use this data.

### Quran.com

https://github.com/quran/quran.com-frontend-next/tree/master/data

## Quran text

### Tanzil

https://tanzil.net/download

## Quran fonts

### Uthman Taha font (King Fahd Complex)

https://fonts.qurancomplex.gov.sa/wp02/%d8%ad%d9%81%d8%b5/

A specialized font for Uthman Taha orthography in the Hafs recitation. We strongly recommend it when using this orthography.

The [Complex's website](https://fonts.qurancomplex.gov.sa/) also offers specialized fonts for other recitations, such as Warsh and Qalun.

### Moshaf font

https://moshaf.org/fa/news/204/

Created by the Center for Printing and Publication of the Holy Quran of the Islamic Republic of Iran. Matching Quran text is available from the same page.

### Muhammad font

https://rojat.com/fa/download/list/download-quranic-font-muhammad(saww)

![Muhammad font](<https://rojat.com/img/download/1/font-muhammad(saww).jpg>)

This font offers broad coverage and strong compatibility with both Imla and Uthman Taha orthographies. Its appearance is more informal than the familiar Quranic Naskh style.

### Fonts with precise page reproduction

Some Quran fonts are designed to reproduce a printed mushaf exactly. Each page has its own font file, and each word on that page is represented by a single character.

Uthman Taha version 1:

https://github.com/quran/quran.com-frontend-next/tree/master/public/fonts/quran/hafs/v1

Uthman Taha version 2:

https://github.com/quran/quran.com-frontend-next/tree/master/public/fonts/quran/hafs/v2

### Other fonts

::: details Fonts with more limited compatibility or availability

#### Kufyan

https://persiangfx.com/fa/design-tools/font/persian-font/kufyan-arabic/

A font with eight weights suitable for Quran text.

#### Al Qalam

https://arabicfonts.net/fonts/al-qalam-quran-majeed-web-regular

#### Vazeh

https://vazeh.org/font/

A high-quality Iranian font for Imla orthography, made in three weights. Its creators have not publicly released the font files. Even if files can be extracted from the published application's APK, we do not have a license to use them.

#### Uthman Taha (Me_Quran)

https://github.com/quran/quran.com-frontend-next/tree/master/public/fonts/quran/hafs/me_quran

https://fontsgeek.com/fonts/me_quran-regular

Less specialized and complete than the King Fahd Complex font, but more broadly compatible with texts such as Imla. The Complex's font is designed specifically for its accompanying text; Me_Quran is more general but less precise.

#### Quran Taha

https://www.fontyab.com/1376/qurantaha.html

Listed for completeness. Its precision and quality are lower than the Complex's Uthman Taha font and Me_Quran. Commissioned by Iran's Supreme Council of Information and Communication Technology.

#### Neirizi

https://www.fontyab.com/1369/neirizi.html

This font is incompatible with Uthman Taha and Imla texts and only partially supports lightly marked text, so we do not recommend it for applications. It was also commissioned by Iran's Supreme Council of Information and Communication Technology.

:::

### Special-purpose fonts

Bismillah: https://github.com/quran/quran.com-fonts/tree/master/public/fonts/bismillah

Surah names: https://github.com/quran/quran.com-fonts/tree/master/public/fonts/surah_names

## Quran translations

https://tanzil.net/trans/

## Verse images

### Uthman Taha

https://govarjabbar.github.io/Quran-PNG/

This repository includes both verse-by-verse and page-by-page images in Uthman Taha orthography.

## Page images

### Center for Printing and Publication of the Holy Quran of Iran

The Center publishes high-quality images of its printed editions. The images were not prepared specifically for developers, so integrating them takes extra work. We hope to provide scripts for using these resources in Ghoran.

#### Mushaf of the Islamic Republic of Iran

https://moshaf.org/fa/news/197/

#### Educational edition

https://moshaf.org/fa/news/214/

#### Quran Hakim: general edition

https://moshaf.org/fa/news/238/

Each page has a translation in the margin, plus a separate page of additional explanation.

#### Quran Hakim: school edition

https://moshaf.org/fa/news/234/

#### Quran Hakim: university edition

https://moshaf.org/fa/news/233/

#### Two-column Quran

https://moshaf.org/fa/news/240/

One column contains Quran text and the other its translation. It uses lightly marked orthography with silent letters colored.

#### Calligraphy by Morteza Rahnama

https://moshaf.org/fa/news/241/

#### Calligraphy by Mohammad Ali Ghorbani

https://moshaf.org/fa/news/240/

#### Editions for other Muslim countries

Indian: https://moshaf.org/fa/news/231/

Egyptian: https://moshaf.org/fa/news/199/

### Uthman Taha

https://github.com/QuranHub/quran-pages-images/tree/main

## Quran audio

http://www.versebyversequran.com/

## Other interesting projects

The following Quran projects are worth exploring, although their usage licenses may be unclear and may not permit integration into our own applications.

### Noor Quran

https://quran.inoor.ir/fa/ayah/2/83/translate

Noor's Quran products offer an extensive collection of translations, commentaries and related material.

### Audio and visual translation

Narration by Behrouz Razavi with translation by Masoud Riaei:

http://www.masoudriaei.com/index.php/quranv

### Tanin Vahy

Dramatized Quran translation.

### Mojezeh

Quran translation narrated by well-known voice actors.

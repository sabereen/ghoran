# ریسورس‌های قرآن برای برنامه‌نویسان جاوااسکریپتی

[مستندات Ghoran](https://sabereen.github.io/ghoran/)

## توسعه و بیلد

برای توسعه از Node.js نسخهٔ `22.18+` یا `24.11+` و pnpm نسخهٔ `12.11.2` استفاده کنید.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm check:packages
pnpm docs:build
```

بیلد هر هشت کتابخانه با `tsdown` انجام می‌شود. تنظیمات مشترک در
`tsdown.shared.ts` و ورودی هر پکیج در `tsdown.config.ts` همان پکیج قرار دارد.
مسیر خروجی جاوااسکریپت `dist/*.mjs` و مسیر تایپ‌ها `dist/*.d.ts` است؛
فونت‌های TTF/WOFF2 و JSON متن‌ها نیز همراه پکیج منتشر می‌شوند.

`pnpm check:packages` پکیج‌ها را pack می‌کند، آن‌ها را بدون شبکه در پروژه‌ای مستقل
نصب می‌کند و import، تایپ‌ها، بارگیری متن، ترجمه و مسیر فونت‌ها را بررسی می‌کند.

بیلد ترجمه از دادهٔ منتشرشدهٔ `@ghoran/translation@0.0.9` که در lockfile قفل شده
است استفاده می‌کند. دریافت مستقیم فهرست و ترجمه‌های جدید از تنزیل دستور مستقلی
است و به دسترسی شبکه نیاز دارد:

```bash
pnpm --filter @ghoran/translation generate-texts
```

TypeScript روی شاخهٔ ۶ نگه داشته شده تا با نسخهٔ پایدار TypeDoc سازگار باشد.

برای اجرای همهٔ بررسی‌ها به‌ترتیب از `pnpm verify` استفاده کنید.

## انتشار مستندات روی GitHub Pages

مستندات به‌صورت استاتیک در [GitHub Pages](https://sabereen.github.io/ghoran/)
منتشر می‌شوند. در تنظیمات مخزن، بخش `Settings → Pages → Build and deployment`،
گزینهٔ `Source` را یک‌بار روی `GitHub Actions` قرار دهید.

workflow فایل `.github/workflows/docs.yml` با هر push روی `main`، وابستگی‌ها را
با lockfile نصب می‌کند، کتابخانه‌ها و مستندات را می‌سازد و خروجی
`docs/.vitepress/dist` را با اکشن‌های رسمی Pages منتشر می‌کند. اجرای دستی از
بخش `Actions → Deploy documentation → Run workflow` روی شاخهٔ `main` نیز ممکن است.
انتشار فقط از `main` انجام می‌شود؛ بررسی بیلد pull requestها در CI موجود اجرا می‌شود.
این روند به secret اختصاصی نیاز ندارد و از `GITHUB_TOKEN` خودکار استفاده می‌کند.

مسیر پایهٔ VitePress برابر `/ghoran/` است تا لینک‌ها، فونت‌ها و Worker جستجو
در زیردایرکتوری مخزن درست بارگیری شوند. برای پیش‌نمایش محلی:

```bash
pnpm build
pnpm docs:build
pnpm --filter @ghoran/docs docs:preview
```

پیش‌نمایش را در مسیر `/ghoran/` باز کنید. پس از اولین انتشار موفق روی Pages،
انتشار خودکار سایت قبلی را در پنل Netlify متوقف کنید؛ اتصال آن خارج از تنظیمات
این مخزن است. آدرس‌های قدیمی Netlify خودکار به Pages هدایت نمی‌شوند.

## انتشار روی npm

روال انتشار پکیج‌ها، اتصال یک‌بارهٔ Trusted Publisher و روش افزایش نسخه‌ها در
[راهنمای انتشار npm](docs/npm-release.md) توضیح داده شده است.
با پوش tagهایی که با `npm-` شروع می‌شوند، بیلد و تست اجرا و خروجی تأییدشده
به‌صورت خودکار روی npm منتشر می‌شود.

## جستجو در قرآن

`@ghoran/search` یک موتور جستجوی مستقل از فریم‌ورک، همراه با نرمال‌سازی عربی،
هایلایت رسم‌الخط‌های مختلف و Worker اختیاری است.

```ts
import { createQuranSearch } from '@ghoran/search'
const search = await createQuranSearch()
const results = await search.search('الرحمن الرحيم')
```

[راهنمای جستجو و نمونهٔ تعاملی](https://sabereen.github.io/ghoran/packages/search)

## متادیتا و تحلیل صوت

`@ghoran/audio` داده‌های اندازه‌گیری‌شدهٔ صوت، تحلیل آماری و پیشنهاد Gain متصل به هش فایل را مستقل از هر اپلیکیشن نگه می‌دارد. ابزار Python/FFmpeg و گزارش‌های توزیع و پیوستگی بلندی در `packages/audio` قرار دارند. پوشش واقعی داده صریح است و هیچ MP3 خودکار تغییر نمی‌کند.

[راهنمای پکیج تحلیل صوت](packages/audio/README.md)

# ریسورس‌های قرآن برای برنامه‌نویسان جاوااسکریپتی

[Ghoran.netlify.app](https://ghoran.netlify.app)

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

بیلد هر هفت کتابخانه با `tsdown` انجام می‌شود. تنظیمات مشترک در
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

## انتشار روی npm

روال انتشار هفت پکیج، اتصال یک‌بارهٔ Trusted Publisher و روش افزایش نسخه‌ها در
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

[راهنمای جستجو و نمونهٔ تعاملی](https://ghoran.netlify.app/packages/search)

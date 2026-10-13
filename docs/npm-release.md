# انتشار روی npm

شش پکیج عمومی پروژه با workflow زیر منتشر می‌شوند:

[Publish to npm](https://github.com/sabereen/ghoran/actions/workflows/npm-release.yml)

قبل از انتشار، بیلد، TypeScript، تست‌ها، نصب مستقل tarballها و بیلد مستندات اجرا
می‌شوند. سپس همان tarballهای آماده‌شده در job جداگانه با provenance منتشر
می‌شوند. نسخه‌هایی که قبلاً منتشر شده‌اند در اجرای مجدد رد می‌شوند؛ انتشار
پکیج‌های وابسته بعد از وابستگی‌هایشان انجام می‌شود.

## اتصال یک‌بارهٔ npm به گیت‌هاب

این روال از [Trusted Publishing رسمی npm](https://docs.npmjs.com/trusted-publishers/)
استفاده می‌کند و به `NPM_TOKEN` نیاز ندارد. مالک یا نگه‌دارندهٔ هر شش پکیج باید
در npm، بخش Settings → Trusted Publisher، گزینهٔ GitHub Actions را با مشخصات
زیر تنظیم کند:

| فیلد                 | مقدار                                 |
| -------------------- | ------------------------------------- |
| Organization or user | `sabereen`                            |
| Repository           | `ghoran`                              |
| Workflow filename    | `npm-release.yml`                     |
| Environment name     | خالی                                  |
| Allowed actions      | اجازهٔ انتشار مستقیم با `npm publish` |

این تنظیم را برای `@ghoran/entity`، `@ghoran/font-page`، `@ghoran/metadata`،
`@ghoran/text`، `@ghoran/translation` و `@ghoran/utils` انجام دهید.
نام workflow فقط نام فایل است، نه مسیر کامل `.github/workflows/...`.

## اولین انتشار آماده‌شده

نسخه‌های این نوبت در package.json و lockfile آماده شده‌اند:

| پکیج                  | نسخه     |
| --------------------- | -------- |
| `@ghoran/entity`      | `0.2.2`  |
| `@ghoran/font-page`   | `0.0.8`  |
| `@ghoran/metadata`    | `0.0.8`  |
| `@ghoran/text`        | `0.0.9`  |
| `@ghoran/translation` | `0.0.10` |
| `@ghoran/utils`       | `0.0.8`  |

بعد از تنظیم Trusted Publisher، در صفحهٔ Action گزینهٔ **Run workflow** را روی
برنچ `main` اجرا کنید. برای آزمایش بدون انتشار، `dry_run` را فعال کنید؛ پیش‌فرض
این ورودی خاموش است و workflow واقعاً منتشر می‌کند.

## انتشارهای بعدی

```bash
pnpm release:version patch
pnpm verify
git add .
git commit -m "chore: prepare npm release"
git push origin main
git tag npm-release-2
git push origin npm-release-2
```

نام tag باید یکتا باشد و با `npm-` شروع شود. با پوش چنین tagهایی انتشار خودکار
اجرا می‌شود. tag فقط نام این نوبت انتشار است؛ نسخهٔ هر پکیج از package.json
آن خوانده می‌شود. به‌جای tag می‌توانید همیشه از **Run workflow** استفاده کنید.
workflow تنها commitهایی را منتشر می‌کند که در تاریخچهٔ `main` باشند.

روال CI روی push به `main` و pull requestها نیز اجرا می‌شود، ولی چیزی منتشر نمی‌کند.
تغییر کد بدون افزایش نسخه، نسخهٔ موجود روی npm را جایگزین نمی‌کند.

## آزمایش محلی

```bash
pnpm verify
pnpm release:pack
pnpm release:dry-run
```

tarballها و manifest در `work/npm-release/` ساخته می‌شوند. انتشار مستقیم محلی
با `pnpm release:publish` به ورود معتبر npm نیاز دارد؛ provenance برای انتشار
در GitHub Actions تنظیم شده است.

import { defineConfig } from 'vitepress'
import UnoCSS from 'unocss/vite'
import assert from 'node:assert'
import { alias } from '../../alias.ts'
import typedocMenu from '../en/types/typedoc-sidebar.json'
import unoConfig from '../uno.config.ts'

typedocMenu.forEach((item) => {
  item.text = `‎@ghoran/${item.text}`
  assert(item.items.length === 1 && item.items[0].text === 'src')
  // @ts-ignore
  item.items = item.items[0].items
})

const persianSidebar = [
  {
    text: 'شروع',
    link: '/getting-start',
  },
  {
    text: 'مفاهیم پایه',
    items: [{ text: 'اندیس آیه', link: '/concepts/ayah-index' }],
  },
  {
    text: 'منابع',
    items: [{ text: 'رسم الخط و فونت', link: '/fonts' }],
  },
  {
    text: 'کتابخانه‌ها',
    items: [
      { text: 'جستجوی قرآن (search)', link: '/packages/search' },
      {
        text: 'متن و فونت قرآن (text)',
        link: '/packages/text',
      },
      {
        text: 'موجودیت‌های داده‌ای قرآن (entity)',
        link: '/packages/entity',
      },
      {
        text: 'متادیتای قرآن (metadata)',
        link: '/packages/metadata',
      },
      {
        text: 'ترجمه‌ی قرآن (translation)',
        link: '/packages/translation',
      },
    ],
  },
  {
    text: 'ابزارها',
    items: [{ text: 'انتخابگر آیه', link: '/tools/select-ayah/' }],
  },
  {
    text: 'نمونه کد',
    items: [
      { text: 'جستجوی زندهٔ قرآن', link: '/demo/search/' },
      { text: 'استفاده از فونت', link: '/demo/font/' },
      { text: 'استفاده از سوره‌ها', link: '/demo/surah/' },
    ],
  },
  {
    text: 'آزمایش‌ها',
    items: [{ text: 'آفست آیه', link: '/experiments/ayah-offset/' }],
  },
  { text: 'انتشار روی npm', link: '/npm-release' },
  {
    text: 'API',
    items: typedocMenu,
  },
  {
    text: 'مجوزها',
    link: '/appreciation',
  },
  {
    text: 'کارهای مشابه',
    items: [
      { text: 'کارهای مشابه', link: '/others/' },
      { text: 'ریسورس‌های قرآنی', link: '/others/resources' },
    ],
  },
]

const englishSidebar = [
  {
    text: 'Get started',
    link: '/en/getting-start',
  },
  {
    text: 'Core concepts',
    items: [{ text: 'Ayah index', link: '/en/concepts/ayah-index' }],
  },
  {
    text: 'Resources',
    items: [{ text: 'Orthographies and fonts', link: '/en/fonts' }],
  },
  {
    text: 'Packages',
    items: [
      { text: 'Quran search (search)', link: '/en/packages/search' },
      {
        text: 'Quran text and fonts (text)',
        link: '/en/packages/text',
      },
      {
        text: 'Quran entities (entity)',
        link: '/en/packages/entity',
      },
      {
        text: 'Quran metadata (metadata)',
        link: '/en/packages/metadata',
      },
      {
        text: 'Quran translations (translation)',
        link: '/en/packages/translation',
      },
    ],
  },
  {
    text: 'Tools',
    items: [{ text: 'Ayah selector', link: '/en/tools/select-ayah/' }],
  },
  {
    text: 'Examples',
    items: [
      { text: 'Live Quran search', link: '/en/demo/search/' },
      { text: 'Using fonts', link: '/en/demo/font/' },
      { text: 'Using chapters', link: '/en/demo/surah/' },
    ],
  },
  {
    text: 'Experiments',
    items: [{ text: 'Ayah offsets', link: '/en/experiments/ayah-offset/' }],
  },
  { text: 'Publishing to npm', link: '/en/npm-release' },
  {
    text: 'API',
    items: typedocMenu,
  },
  {
    text: 'Licenses',
    link: '/en/appreciation',
  },
  {
    text: 'Related projects',
    items: [
      { text: 'Related projects', link: '/en/others/' },
      { text: 'Quran resources', link: '/en/others/resources' },
    ],
  },
]

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/ghoran/',
  title: 'قرآن - Ghoran',
  description: 'قرآن برای برنامه‌نویسان',
  dir: 'rtl',
  lang: 'fa',
  locales: {
    root: {
      label: 'فارسی',
      lang: 'fa',
      dir: 'rtl',
      title: 'قرآن - Ghoran',
      description: 'قرآن برای برنامه‌نویسان',
      themeConfig: {
        nav: [
          { text: 'خانه', link: '/' },
          { text: 'مجوزها', link: '/appreciation' },
        ],
        sidebar: persianSidebar,
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      dir: 'ltr',
      title: 'Ghoran',
      description: 'Quran for developers',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Licenses', link: '/en/appreciation' },
        ],
        sidebar: englishSidebar,
        outline: { label: 'On this page' },
        docFooter: { prev: 'Previous page', next: 'Next page' },
      },
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sabereen/ghoran' },
    ],
  },
  vite: {
    worker: { format: 'es' },
    plugins: [UnoCSS(unoConfig)],
    resolve: {
      alias,
    },
  },
})

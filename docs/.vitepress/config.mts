import { defineConfig } from 'vitepress'
import UnoCSS from 'unocss/vite'
import assert from 'node:assert'
import { alias } from '../../alias'
import typedocMenu from '../en/types/typedoc-sidebar.json'
import unoConfig from '../uno.config'

typedocMenu.forEach((item) => {
  item.text = `‎@ghoran/${item.text}`
  assert(item.items.length === 1 && item.items[0].text === 'src')
  // @ts-ignore
  item.items = item.items[0].items
})

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'قرآن - Ghoran',
  description: 'قرآن برای برنامه‌نویسان',
  dir: 'rtl',
  lang: 'fa',
  locales: {
    root: {
      label: 'فارسی',
      lang: 'fa',
      dir: 'rtl',
    },
    en: {
      label: 'English',
      lang: 'en',
      dir: 'ltr',
    },
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'خانه', link: '/' },
      { text: 'مجوزها', link: '/appreciation' },
    ],

    sidebar: [
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
        ],
      },
      {
        text: 'ابزارها',
        items: [{ text: 'انتخابگر آیه', link: '/tools/select-ayah/' }],
      },
      {
        text: 'نمونه کد',
        items: [
          { text: 'استفاده از فونت', link: '/demo/font/' },
          { text: 'استفاده از سوره‌ها', link: '/demo/surah/' },
        ],
      },
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
        items: [{ text: 'کارهای مشابه', link: '/others/' }],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sabereen/ghoran' },
    ],
  },
  vite: {
    plugins: [UnoCSS(unoConfig)],
    resolve: {
      alias,
    },
  },
})

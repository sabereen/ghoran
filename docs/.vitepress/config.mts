import { defineConfig } from 'vitepress'
import UnoCSS from 'unocss/vite'
import { alias } from '../../alias'

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
            text: 'متادیتای قرآن (metadata)',
            link: '/packages/metadata',
          },
        ],
      },
      {
        text: 'نمونه کد',
        items: [
          { text: 'استفاده از فونت', link: '/demo/font/' },
          { text: 'استفاده از سوره‌ها', link: '/demo/surah/' },
        ],
      },
      {
        text: 'مجوزها',
        link: '/appreciation',
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sabereen/ghoran' },
    ],
  },
  vite: {
    plugins: [UnoCSS({})],
    resolve: {
      alias,
    },
  },
})

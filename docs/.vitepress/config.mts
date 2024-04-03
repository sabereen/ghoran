import { defineConfig } from 'vitepress'

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
      { text: 'قدردانی', link: '/appreciation' },
    ],

    sidebar: [
      {
        text: 'فونت و رسم الخط',
        link: '/fonts',
      },
      {
        text: 'منابع',
        items: [{ text: 'رسم الخط و فونت', link: '/fonts' }],
      },
      {
        text: 'قدردانی',
        link: '/appreciation',
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sabereen/ghoran' },
    ],
  },
})

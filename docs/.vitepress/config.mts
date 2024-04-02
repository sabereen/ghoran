import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'قرآن - Ghoran',
  description: 'قرآن برای برنامه‌نویسان',
  dir: 'rtl',
  lang: 'fa-IR',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'خانه', link: '/' },
      // { text: 'Examples', link: '/markdown-examples' },
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
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sabereen/quran' },
    ],
  },
})

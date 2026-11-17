export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
  ],

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'Make Vote',
      meta: [
        { name: 'description', content: '一站式设计和管理线下投票。' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },

  css: ['~/app.css'],

  typescript: {
    nodeTsConfig: {
      compilerOptions: {
        types: ['bun'],
      },
      include: ['../scripts', '../tests', '../cloudflare.config.ts'],
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/workspace': { ssr: false, prerender: true },
  },

  compatibilityDate: '2026-11-14',

  nitro: {
    preset: 'cloudflare_module',
    static: true,
  },

  fonts: {
    provider: 'bunny',
    providers: {
      google: false,
      googleicons: false,
    },
  },

  icon: {
    clientBundle: {
      scan: true,
      icons: ['lucide:align-left', 'lucide:align-center', 'lucide:align-right'],
    },
    provider: 'none',
  },
});

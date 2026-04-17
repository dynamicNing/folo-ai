import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'folo-ai · Follow One Step',
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      ],
    },
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || '',
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
    githubToken: process.env.GITHUB_TOKEN || '',
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    minimaxApiKey: process.env.MINIMAX_API_KEY || '',
    contentArchiveDir: process.env.CONTENT_ARCHIVE_DIR || './content-archive',
    collectorScript: process.env.COLLECTOR_SCRIPT || '',
    public: {
      siteName: 'folo-ai',
    },
  },
  nitro: {
    experimental: { tasks: true },
  },
  vite: {
    server: { fs: { allow: ['..'] } },
  },
})

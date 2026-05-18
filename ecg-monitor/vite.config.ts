/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5173,
  },
  // ─── Vitest 测试配置 ────────────────────────────────────────
  test: {
    globals: true,               // 全局 describe/it/expect，无需 import
    environment: 'jsdom',        // 模拟 DOM 环境
    setupFiles: ['./src/test/setup.ts'], // 测试初始化
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**/*.ts'],
    },
  },
})

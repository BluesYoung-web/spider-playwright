/*
 * @Author: zhangyang
 * @Date: 2022-09-24 15:54:59
 * @LastEditTime: 2022-09-24 18:18:40
 * @Description: 
 */
/// <reference types="vitest" />
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'happy-dom',
    testTimeout: 0
  }
})

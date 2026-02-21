import { resolve } from 'path'
import { defineConfig, mergeConfig, type ConfigEnv, type UserConfig } from 'vite'
import baseConfig from './vite.config'

function resolveBaseConfig(env: ConfigEnv): UserConfig {
  return typeof baseConfig === 'function' ? baseConfig(env) : baseConfig
}

export default defineConfig((env) => {
  return mergeConfig(resolveBaseConfig(env), {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.ssg.html'),
      },
    },
  })
})

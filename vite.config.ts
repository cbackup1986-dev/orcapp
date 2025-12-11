import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

const sharedAlias = {
    '@': path.resolve(__dirname, 'src'),
    '@main': path.resolve(__dirname, 'src/main'),
    '@renderer': path.resolve(__dirname, 'src/renderer'),
    '@shared': path.resolve(__dirname, 'src/shared')
}

export default defineConfig({
    plugins: [
        react(),
        electron([
            {
                entry: 'src/main/index.ts',
                onstart(options) {
                    options.startup()
                },
                vite: {
                    build: {
                        outDir: 'dist-electron/main',
                        rollupOptions: {
                            external: ['better-sqlite3', 'sharp']
                        }
                    },
                    resolve: {
                        alias: sharedAlias
                    }
                }
            },
            {
                entry: 'src/main/preload.ts',
                onstart(options) {
                    options.reload()
                },
                vite: {
                    build: {
                        outDir: 'dist-electron/preload'
                    },
                    resolve: {
                        alias: sharedAlias
                    }
                }
            }
        ]),
        renderer()
    ],
    resolve: {
        alias: sharedAlias
    },
    base: './',
    build: {
        outDir: 'dist'
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true
    }
})

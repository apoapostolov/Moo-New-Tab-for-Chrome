// Build either extension from the same application and permission catalogue.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { packageExtension, browsers } from './scripts/extension-build.mjs';
import project from './moo.config.json';
import progress from 'vite-plugin-progress';

const isProd = process.env.NODE_ENV === 'production';

const prepareBuilds = () => ({
  name: 'prepareBuilds',
  buildStart() {
    this.mooBuildFailed = false;
  },
  buildEnd(error) {
    this.mooBuildFailed = Boolean(error);
  },
  closeBundle() {
    if (isProd && !this.mooBuildFailed) {
      const target = process.env.MOO_BROWSER || project.defaultBrowser;
      const targets = target === 'all' ? browsers : [target];
      for (const browser of targets) packageExtension(browser);
    }
  },
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = process.env.MOO_BROWSER || project.defaultBrowser;
  if (target !== 'all' && !browsers.includes(target)) throw new Error(`Unknown browser: ${target}`);
  if (target === 'all')
    throw new Error('Use scripts/build-extensions.mjs all to create both browser bundles');
  return {
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
      'import.meta.env.VITE_MOO_BROWSER': JSON.stringify(target),
    },
    plugins: [react(), prepareBuilds(), progress()],
    server: { open: true, hmr: { protocol: 'ws', host: 'localhost' } },
    build: {
      target: 'esnext', // Use modern JavaScript features
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
      rollupOptions: {
        output: {
          manualChunks: undefined, // Let Vite handle chunking automatically to avoid circular dependency issues
        },
      },
    },
    resolve: {
      extensions: ['.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        i18n: path.resolve(__dirname, './src/i18n'),
        components: path.resolve(__dirname, './src/components'),
        contexts: path.resolve(__dirname, './src/contexts'),
        assets: path.resolve(__dirname, './src/assets'),
        config: path.resolve(__dirname, './src/config'),
        features: path.resolve(__dirname, './src/features'),
        lib: path.resolve(__dirname, './src/lib'),
        scss: path.resolve(__dirname, './src/scss'),
        translations: path.resolve(__dirname, './src/i18n/locales'),
        utils: path.resolve(__dirname, './src/utils'),
      },
    },
    css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  };
});

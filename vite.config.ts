import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // This allows us to access API_KEY set in Netlify Environment Variables.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    base: '/',
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true, // Enable sourcemaps for debugging
      chunkSizeWarningLimit: 1000,
    },
    define: {
      // Expose env variables to the client code
      // If API_KEY is defined in Netlify UI, env.API_KEY will have it.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});
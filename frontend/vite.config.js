import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/lex/' : '/',
  plugins: [
    react(),
    {
      name: 'dev-autologin',
      configureServer(server) {
        server.middlewares.use('/autologin', (req, res) => {
          const url = new URL(req.url, 'http://localhost');
          const token = url.searchParams.get('t') || '';
          const refresh = url.searchParams.get('r') || '';
          res.setHeader('Content-Type', 'text/html');
          res.end(`<!DOCTYPE html><html><body><script>
            localStorage.setItem('accessToken','${token.replace(/'/g, "\\'")}');
            localStorage.setItem('refreshToken','${refresh.replace(/'/g, "\\'")}');
            location.href='/dashboard';
          <\/script></body></html>`);
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3099',
        changeOrigin: true,
      },
    },
  },
}))

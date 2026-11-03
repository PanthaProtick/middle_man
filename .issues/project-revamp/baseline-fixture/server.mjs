// Disposable, loopback-only visual fixture. Does not load project environment files.
import { createServer } from '../../../frontend/node_modules/vite/dist/node/index.js';
import { resolve } from 'node:path';
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  envDir: '.cache/revamp-baseline-empty-env',
  resolve: { alias: {
    '@clerk/react': resolve('.issues/project-revamp/baseline-fixture/clerk.tsx'),
    react: resolve('frontend/node_modules/react'),
    'react-dom': resolve('frontend/node_modules/react-dom'),
  } },
  plugins: [{ name: 'baseline-buyer-route', configureServer(instance) {
    instance.middlewares.use((request, _response, next) => {
      if (request.url?.startsWith('/orders/synthetic')) {
        request.url = '/.issues/project-revamp/baseline-fixture/index.html' + (request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '');
      }
      next();
    });
  } }],
  server: { host: '127.0.0.1', port: 5186, strictPort: true },
  appType: 'spa',
});
await server.listen();
console.log('Baseline fixture: http://127.0.0.1:5186/.issues/project-revamp/baseline-fixture/index.html');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => { await server.close(); process.exit(0); });
}

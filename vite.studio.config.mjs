import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// Separate offline fixture bundle. Never included in the application build.
export default defineConfig({plugins:[react()],define:{'import.meta.env.DEV':'true'},build:{outDir:'.studio-preview',rollupOptions:{input:'preview.html'}},preview:{host:'127.0.0.1',port:5195,strictPort:true}});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/eng-quiz/', // 🔥 đúng bằng tên repo
});

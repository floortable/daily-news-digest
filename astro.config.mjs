import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isProjectPage = Boolean(process.env.GITHUB_ACTIONS && repository && !repository.endsWith('.github.io'));

export default defineConfig({
  site: process.env.SITE_URL || 'https://floortable.github.io',
  base: isProjectPage ? `/${repository}/` : '/',
  output: 'static',
  publicDir: './generated/public',
});

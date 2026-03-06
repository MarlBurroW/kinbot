// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://marlburrow.github.io',
	base: '/kinbot/docs',
	integrations: [
		starlight({
			expressiveCode: {
				themes: ['rose-pine', 'rose-pine-dawn'],
				styleOverrides: {
					borderRadius: '0.75rem',
					codePaddingBlock: '1rem',
					codePaddingInline: '1.25rem',
					frames: {
						editorTabBarBorderBottomColor: 'oklch(0.24 0.04 300)',
					},
				},
			},
			title: 'KinBot Docs',
			logo: {
				dark: './src/assets/logo-dark.svg',
				light: './src/assets/logo-light.svg',
				replacesTitle: false,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/MarlBurroW/kinbot' },
			],
			customCss: ['./src/styles/custom.css'],
			components: {
				Header: './src/components/Header.astro',
				Head: './src/components/Head.astro',
				SiteTitle: './src/components/SiteTitle.astro',
				Sidebar: './src/components/Sidebar.astro',
				Hero: './src/components/Hero.astro',
				Footer: './src/components/Footer.astro',
				PageFrame: './src/components/PageFrame.astro',
				PageTitle: './src/components/PageTitle.astro',
				TableOfContents: './src/components/TableOfContents.astro',
				Pagination: './src/components/Pagination.astro',
				MobileTableOfContents: './src/components/MobileTableOfContents.astro',
				MobileMenuFooter: './src/components/MobileMenuFooter.astro',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Your First Kin', slug: 'getting-started/first-kin' },
						{ label: 'Configuration', slug: 'getting-started/configuration' },
					],
				},
				{
					label: 'Kins',
					items: [
						{ label: 'Overview', slug: 'kins/overview' },
						{ label: 'System Prompts', slug: 'kins/system-prompts' },
						{ label: 'Tools', slug: 'kins/tools' },
						{ label: 'Memory', slug: 'kins/memory' },
					],
				},
				{
					label: 'Plugins',
					items: [
						{ label: 'Overview', slug: 'plugins/overview' },
						{ label: 'Developing Plugins', slug: 'plugins/developing' },
						{ label: 'Plugin API', slug: 'plugins/api' },
						{ label: 'Store', slug: 'plugins/store' },
					],
				},
				{
					label: 'Mini-Apps',
					items: [
						{ label: 'Overview', slug: 'mini-apps/overview' },
						{ label: 'Getting Started', slug: 'mini-apps/getting-started' },
						{ label: 'Components', slug: 'mini-apps/components' },
						{ label: 'Hooks', slug: 'mini-apps/hooks' },
						{ label: 'SDK Reference', slug: 'mini-apps/sdk-reference' },
						{ label: 'Guidelines', slug: 'mini-apps/guidelines' },
						{ label: 'Backend (_server.js)', slug: 'mini-apps/backend' },
						{ label: 'Examples', slug: 'mini-apps/examples' },
					],
				},
				{
					label: 'Channels',
					items: [
						{ label: 'Overview', slug: 'channels/overview' },
						{ label: 'Telegram', slug: 'channels/telegram' },
						{ label: 'Discord', slug: 'channels/discord' },
						{ label: 'Slack', slug: 'channels/slack' },
						{ label: 'WhatsApp', slug: 'channels/whatsapp' },
						{ label: 'Signal', slug: 'channels/signal' },
						{ label: 'Matrix', slug: 'channels/matrix' },
					],
				},
				{
					label: 'Memory',
					items: [
						{ label: 'How It Works', slug: 'memory/how-it-works' },
						{ label: 'Configuration', slug: 'memory/configuration' },
					],
				},
				{
					label: 'Providers',
					items: [
						{ label: 'Supported Providers', slug: 'providers/supported' },
						{ label: 'Adding Custom', slug: 'providers/custom' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'REST Endpoints', slug: 'api/rest' },
						{ label: 'SSE Events', slug: 'api/sse' },
					],
				},
			],
		}),
	],
});

<script lang="ts">
	import { preferences } from '🍎/state/preferences.svelte.ts';
	import TwitterIcon from '~icons/mdi/twitter';
	import BlogIcon from '~icons/mdi/grease-pencil';
	import WorksIcon from '~icons/ic/round-workspaces';
	import GithubIcon from '~icons/mdi/github';
	import DevToIcon from '~icons/mdi/dev-to';
	import LinkedinIcon from '~icons/mdi/linkedin';
	import InstagramIcon from '~icons/mdi/instagram';
	import EmailIcon from '~icons/mdi/email-outline';
	import ResumeIcon from '~icons/mdi/file-document-outline';
	import WebIcon from '~icons/mdi/web';
	import PaletteIcon from '~icons/mdi/palette-outline';

	function external(node: HTMLAnchorElement) {
		node.rel = 'noopener noreferrer';
		node.target = '_blank';
	}
</script>

<section class="container">
	<header class="titlebar app-window-drag-handle">
		<span>About the Developer</span>
	</header>

	<aside class:light={preferences.theme.scheme === 'light'}>
		<nav>
			<div class="link-group">
				<span class="link-group-title">Puru Vijay</span>
				<a href="https://www.puruvj.dev/blog" use:external> <BlogIcon /> Blog </a>
				<a href="https://www.puruvj.dev/works" use:external> <WorksIcon /> Works </a>
				<a href="https://www.puruvj.dev/twitter" use:external>
					<TwitterIcon />
					Twitter
				</a>
				<a href="https://www.puruvj.dev/github" use:external> <GithubIcon /> GitHub </a>
				<a href="https://www.puruvj.dev/devto" use:external> <DevToIcon /> Dev.to </a>
			</div>

			<hr />

			<div class="link-group">
				<span class="link-group-title">Jacob F. Valdez</span>
				<a href="https://jacobfv.github.io" use:external> <WebIcon /> Website </a>
				<a href="https://jacobfv.github.io/blog/" use:external> <BlogIcon /> Blog </a>
				<a href="https://jacobfv.github.io/projects/" use:external> <WorksIcon /> Projects </a>
				<a href="https://jacobfv.github.io/resume/" use:external> <ResumeIcon /> Resume </a>
				<a href="https://twitter.com/jvboid" use:external>
					<TwitterIcon />
					X / Twitter
				</a>
				<a href="https://www.linkedin.com/in/jacob-f-valdez/" use:external>
					<LinkedinIcon />
					LinkedIn
				</a>
				<a href="https://github.com/JacobFV" use:external> <GithubIcon /> GitHub </a>
				<a href="https://www.instagram.com/jvboid/" use:external>
					<InstagramIcon />
					Instagram
				</a>
				<a href="https://jvboid.art" use:external> <PaletteIcon /> Art </a>
				<a href="mailto:jacob@humanrobots.ai"> <EmailIcon /> Email </a>
			</div>
		</nav>
	</aside>

	<section class="content">
		<div class="developer-grid">
			<article class="developer-card">
				<img class="profile-photo" height="150" width="150" src="./purus-profile/puru.webp" alt="Puru Vijay" />

				<h1>Puru Vijay</h1>
				<h2>Creator of the original macOS Web</h2>

				<p>
					Puru created macOS Web and built the original Svelte desktop experience this project
					started from. His work focuses on frontend engineering, web craft, and expressive
					interfaces.
				</p>

				<div class="quick-links">
					<a href="https://www.puruvj.dev/works" use:external>Works</a>
					<a href="https://www.puruvj.dev/blog" use:external>Blog</a>
					<a href="https://www.puruvj.dev/github" use:external>GitHub</a>
				</div>
			</article>

			<article class="developer-card">
				<img
					class="profile-photo"
					height="150"
					width="150"
					src="./purus-profile/jacob.jpg"
					alt="Jacob F. Valdez"
				/>

				<h1>Jacob F. Valdez</h1>
				<h2>Software engineer building AI systems</h2>

				<p>
					Jacob is building <a href="https://vibestartup.pro" use:external>VibeStartup</a>.
					Previously he was API/Integration Architect at
					<a href="https://agi.app" use:external>AGI, Inc.</a>, working on APIs, integrations,
					and agent infrastructure for on-device mobile AI agents.
				</p>

				<div class="quick-links">
					<a href="https://jacobfv.github.io/repos/" use:external>Repos</a>
					<a href="https://jacobfv.github.io/papers/" use:external>Papers</a>
					<a href="https://jacobfv.github.io/resume/" use:external>Resume</a>
					<a href="https://www.admonymous.co/jvboid" use:external>Feedback</a>
				</div>
			</article>
		</div>
	</section>
</section>

<style>
	.container {
		--color: var(--system-color-light-hsl);

		display: grid;
		grid-template-columns: 13.5rem minmax(0, 1fr);
		grid-template-rows: 3rem minmax(0, 1fr);

		border-radius: inherit;
		width: 100%;
		height: 100%;
		overflow: hidden;

		background-image: linear-gradient(
			to right,
			hsla(var(--color), 0.7) 13.5rem,
			hsla(var(--color), 1) 13.5rem 100%
		);

		transition: --color 200ms ease-in;

		color: var(--system-color-dark);
	}

	.titlebar {
		grid-area: 1 / 1 / span 1 / span 2;

		display: flex;
		justify-content: center;

		z-index: 1;

		padding: 0.9rem 1rem;

		width: 100%;

		border-top-left-radius: inherit;
		border-top-right-radius: inherit;

		user-select: none;

		span {
			color: hsla(var(--system-color-dark-hsl), 0.8);
			font-weight: 500;
			font-size: 0.9rem;
			letter-spacing: 0.5px;
		}
	}

	aside {
		grid-area: 1 / 1 / span 2 / span 1;

		transform: translateZ(0);

		height: calc(100% - 2.7px);
		width: calc(13.5rem - 2.27px);
		min-height: 0;
		overflow-x: hidden;
		overflow-y: auto;
		scrollbar-gutter: stable;

		margin: 1.8px 0 0px 1.8px;

		border-top-left-radius: 0.5rem;
		border-bottom-left-radius: inherit;

		&::before {
			content: '';

			width: inherit;
			height: inherit;

			border-radius: inherit;

			position: fixed;
			left: 0;
			top: 0;

			z-index: -1;
			backdrop-filter: blur(12px);
		}

		&.light {
			height: calc(100% - 3px);
			width: calc(13.5rem - 2.5px);

			margin: 1.7px 0 0px 1.7px;

			border-top-left-radius: 0.5rem;
			border-bottom-left-radius: 0.5rem;
		}

		&::-webkit-scrollbar {
			width: 0.55rem;
		}

		&::-webkit-scrollbar-thumb {
			background-color: hsla(var(--system-color-dark-hsl), 0.18);
			border: 0.18rem solid transparent;
			border-radius: 999px;
			background-clip: padding-box;
		}

		nav {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;

			margin: 4rem 0.6rem 1rem;

			hr {
				display: block;

				width: 100%;
				height: 1px;

				background-color: hsla(var(--system-color-dark-hsl), 0.2);

				border: none;
			}

			.link-group {
				display: flex;
				flex-direction: column;
				gap: 0.2rem;
			}

			.link-group-title {
				color: hsla(var(--system-color-dark-hsl), 0.58);
				font-size: 0.72rem;
				font-weight: 700;
				letter-spacing: 0.06em;
				padding: 0.35rem 0.5rem 0.1rem;
				text-transform: uppercase;
			}

			a {
				display: flex;
				gap: 0.4rem;
				align-items: center;

				color: hsla(var(--system-color-dark-hsl), 0.9);
				text-decoration: none;
				font-weight: 400;

				padding: 0.5rem 0.5rem;

				border-radius: 0.4rem;

				transition: background-color 100ms ease;

				&:hover {
					background-color: hsla(var(--system-color-dark-hsl), 0.2);
				}
			}
		}
	}

	.content {
		grid-area: 2 / 2 / span 1 / span 1;

		min-width: 0;
		min-height: 0;
		padding: 1.2rem;
		overflow-x: hidden;
		overflow-y: auto;
		scrollbar-gutter: stable;

		&::-webkit-scrollbar {
			width: 0.65rem;
		}

		&::-webkit-scrollbar-thumb {
			background-color: hsla(var(--system-color-dark-hsl), 0.2);
			border: 0.2rem solid transparent;
			border-radius: 999px;
			background-clip: padding-box;
		}

		.profile-photo {
			border-radius: 50%;
			object-fit: cover;
			box-shadow: 0 12px 32px hsla(var(--system-color-dark-hsl), 0.18);
		}
	}

	.developer-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.2rem;
		min-height: 100%;
		align-items: stretch;
	}

	.developer-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		border-radius: 1rem;
		background: hsla(var(--system-color-dark-hsl), 0.04);
		border: 1px solid hsla(var(--system-color-dark-hsl), 0.08);
	}

	h1 {
		margin-top: 0.8rem;
		font-size: 1.8rem;
		line-height: 1.15;
		text-align: center;
	}

	h2 {
		margin-top: 0.35rem;
		font-size: 1rem;
		line-height: 1.25;
		text-align: center;
		color: hsla(var(--system-color-dark-hsl), 0.72);
	}

	p {
		max-width: 28rem;
		margin-top: 1rem;
		line-height: 1.618rem;
		text-align: center;

		a {
			color: inherit;
			font-weight: 600;
		}
	}

	.quick-links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 1.5rem;

		a {
			padding: 0.45rem 0.75rem;
			border-radius: 999px;
			background: hsla(var(--system-color-dark-hsl), 0.08);
			color: hsla(var(--system-color-dark-hsl), 0.9);
			text-decoration: none;
			font-size: 0.9rem;
			font-weight: 500;

			&:hover {
				background: hsla(var(--system-color-dark-hsl), 0.14);
			}
		}
	}
</style>

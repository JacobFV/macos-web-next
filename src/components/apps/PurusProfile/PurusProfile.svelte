<script lang="ts">
	import { preferences } from '🍎/state/preferences.svelte.ts';
	import TwitterIcon from '~icons/mdi/twitter';
	import BlogIcon from '~icons/mdi/grease-pencil';
	import WorksIcon from '~icons/ic/round-workspaces';
	import GithubIcon from '~icons/mdi/github';
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
			<a href="https://jacobfv.github.io" use:external> <WebIcon /> Website </a>
			<a href="https://jacobfv.github.io/blog/" use:external> <BlogIcon /> Blog </a>
			<a href="https://jacobfv.github.io/projects/" use:external> <WorksIcon /> Projects </a>
			<a href="https://jacobfv.github.io/resume/" use:external> <ResumeIcon /> Resume </a>

			<hr />

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
		</nav>
	</aside>

	<section class="content">
		<img
			class="profile-photo"
			height="200"
			width="200"
			src="https://jacobfv.github.io/assets/img/prof_pic.jpg"
			alt="Jacob F. Valdez"
		/>

		<br />

		<h1>Jacob F. Valdez</h1>

		<h2>Software engineer building AI systems</h2>

		<br /><br />

		<p>
			Jacob is building <a href="https://vibestartup.pro" use:external>VibeStartup</a>.
			Previously he was API/Integration Architect at
			<a href="https://agi.app" use:external>AGI, Inc.</a>, working on APIs, integrations,
			and agent infrastructure for on-device mobile AI agents.
		</p>

		<br /><br />

		<p>
			Earlier work includes Breezy, Deepshard, Motio, and UTA research labs. He studied
			computer science at UT Arlington and writes about science, engineering, people, and AI.
		</p>

		<div class="quick-links">
			<a href="https://jacobfv.github.io/repos/" use:external>Repos</a>
			<a href="https://jacobfv.github.io/papers/" use:external>Papers</a>
			<a href="https://www.admonymous.co/jvboid" use:external>Feedback</a>
			<a href="https://www.f6s.com/member/jacob-valdez?follow=1" use:external>F6S</a>
		</div>
	</section>
</section>

<style>
	.container {
		--color: var(--system-color-light-hsl);

		display: grid;
		grid-template-columns: 12rem 1fr;
		grid-template-rows: 3rem 1fr;

		border-radius: inherit;

		background-image: linear-gradient(
			to right,
			hsla(var(--color), 0.7) 12rem,
			hsla(var(--color), 1) 12rem 100%
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
		width: calc(12rem - 2.27px);

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
			width: calc(12rem - 2.5px);

			margin: 1.7px 0 0px 1.7px;

			border-top-left-radius: 0.5rem;
			border-bottom-left-radius: 0.5rem;
		}

		nav {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;

			margin: 4rem 0.6rem;

			hr {
				display: block;

				width: 100%;
				height: 1px;

				background-color: hsla(var(--system-color-dark-hsl), 0.2);

				border: none;
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

		display: flex;
		flex-direction: column;
		align-items: center;

		padding: 1rem;

		.profile-photo {
			border-radius: 50%;
			object-fit: cover;
			box-shadow: 0 12px 32px hsla(var(--system-color-dark-hsl), 0.18);
		}
	}

	h1 {
		font-size: 2.618rem;
		line-height: 1.618;
		text-align: center;
	}

	h2 {
		font-size: 1.618rem;
		line-height: 1.2;
		text-align: center;
		color: hsla(var(--system-color-dark-hsl), 0.72);
	}

	p {
		max-width: 34rem;
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
		margin-top: 1.5rem;

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

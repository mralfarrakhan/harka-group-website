<script lang="ts">
	import { authClient } from "~/lib/auth-client";
	import { slide } from "svelte/transition";

	let { user, role } = $props<{
		user: {
			name: string;
			email: string;
			image?: string | null;
		};
		role?: "superadmin" | "admin" | null;
	}>();

	let isOpen = $state(false);

	const toggleDropdown = () => {
		isOpen = !isOpen;
	};

	const closeDropdown = (e: MouseEvent) => {
		if (isOpen && !(e.target as Element).closest(".user-profile-dropdown")) {
			isOpen = false;
		}
	};

	const handleLogout = async () => {
		await authClient.signOut();
		window.location.href = "/login";
	};

	// Fallback avatar URL if no image is provided
	const avatarUrl =
		user.image ||
		`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
</script>

<svelte:window onclick={closeDropdown} />

<div class="user-profile-dropdown relative hidden md:block">
	<button
		onclick={toggleDropdown}
		class="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-red-800 focus:outline-none"
		aria-haspopup="true"
		aria-expanded={isOpen}
	>
		<img
			src={avatarUrl}
			alt={user.name}
			class="h-8 w-8 rounded-full border border-red-600 object-cover"
			referrerpolicy="no-referrer"
		/>
		<div class="flex hidden items-center gap-2 lg:flex">
			<span class="text-sm leading-tight font-medium text-white">{user.name}</span>
			{#if role}
				<span
					class={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
						role === "superadmin"
							? "border border-purple-400/40 bg-purple-900/90 text-purple-200"
							: "border border-red-500/40 bg-red-900/90 text-red-100"
					}`}
				>
					{role}
				</span>
			{/if}
		</div>
		<svg
			class={`h-4 w-4 text-red-200 transition-transform ${isOpen ? "rotate-180" : ""}`}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isOpen}
		<div
			transition:slide={{ duration: 200 }}
			class="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none"
		>
			<div class="mb-1 border-b border-gray-100 px-4 py-2">
				<div class="flex items-center justify-between gap-2">
					<p class="truncate text-sm font-medium text-gray-900">{user.name}</p>
					{#if role}
						<span
							class={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
								role === "superadmin"
									? "border border-purple-200 bg-purple-100 text-purple-800"
									: "border border-gray-200 bg-gray-100 text-gray-700"
							}`}
						>
							{role}
						</span>
					{/if}
				</div>
				<p class="truncate text-xs text-gray-500">{user.email}</p>
			</div>
			<button
				onclick={handleLogout}
				class="block w-full px-4 py-2 text-left text-sm text-red-700 transition-colors hover:bg-red-50"
			>
				Sign out
			</button>
		</div>
	{/if}
</div>

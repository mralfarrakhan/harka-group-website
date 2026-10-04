<script lang="ts">
	import type { TradeInStatus } from "@harka/db";

	interface Props {
		submissionId: string;
		initialStatus?: TradeInStatus;
		initialReviewedAt?: string | null;
		initialReviewedBy?: string | null;
		convertedCarId?: string | null;
	}

	let {
		submissionId,
		initialStatus = "pending",
		initialReviewedAt = null,
		initialReviewedBy = null,
		convertedCarId = null,
	}: Props = $props();

	let currentStatus = $state<TradeInStatus>(initialStatus);
	let reviewedAt = $state<string | null>(initialReviewedAt);
	let reviewedBy = $state<string | null>(initialReviewedBy);
	let linkedCarId = $state<string | null>(convertedCarId);
	let isLoading = $state(false);

	let toast = $state<{ show: boolean; message: string; type: "success" | "error" }>({
		show: false,
		message: "",
		type: "success",
	});

	function showToast(message: string, type: "success" | "error" = "success") {
		toast = { show: true, message, type };
		setTimeout(() => {
			toast.show = false;
		}, 3500);
	}

	function formatDate(isoString: string | null) {
		if (!isoString) return "";
		try {
			const d = new Date(isoString);
			return d.toLocaleDateString("id-ID", {
				day: "numeric",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return "";
		}
	}

	async function updateStatus(newStatus: TradeInStatus) {
		if (isLoading) return;
		isLoading = true;
		const previousStatus = currentStatus;
		const previousReviewedAt = reviewedAt;
		const previousReviewedBy = reviewedBy;

		// Optimistic update
		currentStatus = newStatus;
		if (newStatus === "pending") {
			reviewedAt = null;
			reviewedBy = null;
		} else {
			reviewedAt = new Date().toISOString();
		}

		try {
			const res = await fetch(`/api/trade-in/${submissionId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newStatus }),
			});

			const data = (await res.json()) as {
				success?: boolean;
				error?: string;
				status?: TradeInStatus;
				reviewedAt?: string | null;
				reviewedBy?: string | null;
			};

			if (!res.ok || !data.success) {
				throw new Error(data.error || "Gagal memperbarui status pengajuan");
			}

			if (data.reviewedAt !== undefined) reviewedAt = data.reviewedAt;
			if (data.reviewedBy !== undefined) reviewedBy = data.reviewedBy;

			if (newStatus === "approved") {
				showToast("Status berhasil diubah menjadi: Reviewed & Approved!", "success");
			} else if (newStatus === "rejected") {
				showToast("Pengajuan ditandai sebagai: Ditolak.", "success");
			} else {
				showToast("Status dikembalikan ke: Menunggu Review.", "success");
			}
		} catch (err: unknown) {
			// Revert on error
			currentStatus = previousStatus;
			reviewedAt = previousReviewedAt;
			reviewedBy = previousReviewedBy;
			const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
			showToast(msg, "error");
		} finally {
			isLoading = false;
		}
	}
</script>

<div
	class={`relative mb-8 rounded-2xl border border-l-4 border-gray-200 bg-white p-5 shadow-sm transition-all sm:p-6 ${
		currentStatus === "approved"
			? "border-l-emerald-500"
			: currentStatus === "rejected"
				? "border-l-red-500"
				: "border-l-amber-500"
	}`}
>
	<!-- Toast Message -->
	{#if toast.show}
		<div
			class={`absolute -top-4 right-6 z-30 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-lg transition-all ${
				toast.type === "success"
					? "border border-gray-700 bg-gray-900 text-emerald-300"
					: "border border-red-700 bg-red-900 text-white"
			}`}
		>
			{#if toast.type === "success"}
				<svg
					class="size-4 shrink-0 text-emerald-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			{:else}
				<svg
					class="size-4 shrink-0 text-red-300"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			{/if}
			<span>{toast.message}</span>
		</div>
	{/if}

	<div class="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
		<!-- Left: Status Badge & Information -->
		<div class="space-y-1.5">
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-xs font-bold tracking-wider text-gray-500 uppercase">
					Status Verifikasi
				</span>

				{#if currentStatus === "pending"}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"
					>
						<span class="size-2 animate-pulse rounded-full bg-amber-500"></span>
						Menunggu Review
					</span>
				{:else if currentStatus === "approved"}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
					>
						<svg class="size-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
						Reviewed & Approved
					</span>

					{#if linkedCarId}
						<span
							class="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700"
						>
							<svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							Sudah Masuk Inventaris
						</span>
					{/if}
				{:else}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800"
					>
						<svg class="size-3.5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
						Ditolak
					</span>
				{/if}
			</div>

			<p class="text-xs text-gray-500 sm:text-sm">
				{#if currentStatus === "pending"}
					Unit pengajuan ini belum diverifikasi. Periksa spesifikasi dan kelengkapan fisik sebelum
					menyetujui.
				{:else if currentStatus === "approved"}
					Unit telah diverifikasi dan disetujui{#if reviewedBy}
						oleh <strong class="font-medium text-gray-800">{reviewedBy}</strong
						>{/if}{#if reviewedAt}
						pada {formatDate(reviewedAt)}{/if}.
				{:else}
					Pengajuan ini ditandai tidak memenuhi syarat / ditolak{#if reviewedBy}
						oleh <strong class="font-medium text-gray-800">{reviewedBy}</strong
						>{/if}{#if reviewedAt}
						pada {formatDate(reviewedAt)}{/if}.
				{/if}
			</p>
		</div>

		<!-- Right: Action Buttons with uniform height -->
		<div class="flex shrink-0 flex-wrap items-center gap-2.5">
			{#if currentStatus === "pending"}
				<!-- Primary Button: Reviewed & Approved -->
				<button
					type="button"
					disabled={isLoading}
					onclick={() => updateStatus("approved")}
					class="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
				>
					{#if isLoading}
						<svg class="size-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
						</svg>
					{:else}
						<svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					{/if}
					<span>Reviewed & Approved</span>
				</button>

				<!-- Secondary Button: Tolak -->
				<button
					type="button"
					disabled={isLoading}
					onclick={() => updateStatus("rejected")}
					class="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 shadow-xs transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
				>
					<svg class="size-3.5" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
							clip-rule="evenodd"
						/>
					</svg>
					<span>Tolak</span>
				</button>
			{:else if currentStatus === "approved"}
				{#if linkedCarId}
					<a
						href={`/cars/edit/${linkedCarId}`}
						class="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
					>
						<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
						<span>Buka di Inventaris</span>
					</a>
				{:else}
					<a
						href={`/cars/new?fromTradeIn=${submissionId}`}
						class="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
					>
						<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span>Jadikan Draf Inventaris</span>
					</a>
				{/if}

				<button
					type="button"
					disabled={isLoading}
					onclick={() => updateStatus("pending")}
					class="inline-flex h-10 cursor-pointer items-center justify-center px-3 text-xs font-medium text-gray-400 transition hover:text-gray-700 hover:underline"
					title="Kembalikan status ke Menunggu Review"
				>
					<span>Batal Review</span>
				</button>
			{:else}
				<button
					type="button"
					disabled={isLoading}
					onclick={() => updateStatus("pending")}
					class="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50"
				>
					<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					<span>Tinjau Ulang Pengajuan</span>
				</button>
			{/if}
		</div>
	</div>
</div>

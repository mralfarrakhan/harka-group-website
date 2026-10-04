<script lang="ts">
	import { navigate } from "astro:transitions/client";
	import {
		ownershipStatuses,
		ownershipStatusMap,
		validatePlateNumber,
		formatPlateNumber,
		type Car,
	} from "@harka/db";
	import { compressCarImages } from "~/utils/imageCompression";

	interface Props {
		car?: Partial<Car> | null;
		fromTradeIn?: string | null;
	}

	let { car = null, fromTradeIn = null }: Props = $props();

	let isLoading = $state(false);
	let statusMessage = $state("");
	let errorMessage = $state("");
	let successMessage = $state("");

	let popup = $state({
		show: false,
		title: "",
		message: "",
		type: "success" as "success" | "error",
	});

	const showPopup = (
		title: string,
		message: string,
		type: "success" | "error",
		action: string = "updated",
	) => {
		if (type === "success") {
			navigate(`/cars?toast=${action}`);
		} else {
			popup = { show: true, title, message, type };
			setTimeout(() => {
				popup.show = false;
			}, 4000);
		}
	};

	// Direct Flat Bindings
	let title = $state(car?.title || "");
	let excerpt = $state(car?.excerpt || "");
	let relatedUrl = $state(car?.relatedUrl || "");

	let make = $state(car?.make || "");
	let model = $state(car?.model || "");
	let price = $state(car?.price || 0);
	let year = $state(car?.year || new Date().getFullYear());
	let mileage = $state(car?.mileage ?? 0);
	let bodyType = $state(car?.bodyType || "SUV");
	let fuelType = $state(car?.fuelType || "Petrol");
	let transmission = $state(car?.transmission || "Automatic");
	let color = $state(car?.color || "");

	let horsePower = $state(car?.horsePower ?? null);
	let engineSizeCC = $state(car?.engineSizeCC ?? null);

	let ownershipStatus = $state(car?.ownershipStatus || "first_hand");
	let plateNumber = $state(car?.plateNumber || "");
	let plateError = $state("");

	function handlePlateBlur() {
		const trimmed = plateNumber.trim();
		if (!trimmed) {
			plateError = "";
			plateNumber = "";
			return;
		}
		if (validatePlateNumber(trimmed)) {
			plateError = "";
			plateNumber = formatPlateNumber(trimmed) || trimmed;
		} else {
			plateError = "Format plat nomor tidak valid (mis. B 1234 ABC)";
		}
	}

	function handlePlateInput() {
		if (plateError && (!plateNumber.trim() || validatePlateNumber(plateNumber.trim()))) {
			plateError = "";
		}
	}
	let isFloodFree = $state(car?.isFloodFree ?? false);
	let isAccidentFree = $state(car?.isAccidentFree ?? false);

	const existingTaxDate = car?.taxExpirationDate ? new Date(car.taxExpirationDate) : null;
	let taxMonth = $state(existingTaxDate ? (existingTaxDate.getMonth() + 1).toString() : "");
	let taxYear = $state(existingTaxDate ? existingTaxDate.getFullYear().toString() : "");

	let seatingCapacity = $state(car?.seatingCapacity ?? null);

	const months = [
		{ value: "1", label: "Januari" },
		{ value: "2", label: "Februari" },
		{ value: "3", label: "Maret" },
		{ value: "4", label: "April" },
		{ value: "5", label: "Mei" },
		{ value: "6", label: "Juni" },
		{ value: "7", label: "Juli" },
		{ value: "8", label: "Agustus" },
		{ value: "9", label: "September" },
		{ value: "10", label: "Oktober" },
		{ value: "11", label: "November" },
		{ value: "12", label: "Desember" },
	];

	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 15 }, (_, i) => currentYear - 5 + i);

	let hidden = $state(car?.hidden ?? false);

	// Gallery State
	type GalleryItem = { id: string; url?: string; file?: File; alt: string; preview: string };
	let galleryItems = $state<GalleryItem[]>(
		(car?.gallery || []).map((g, i) => ({
			id: `existing-${i}`,
			url: g.image,
			alt: g.alt,
			preview: g.image,
		})),
	);

	const isFormValid = $derived(
		make.trim() !== "" && model.trim() !== "" && price > 0 && year > 0 && mileage >= 0,
	);

	const handleFileSelect = (e: Event) => {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			const newFiles = Array.from(target.files);
			const newItems = newFiles.map((file) => ({
				id: `new-${Math.random().toString(36).substring(2, 9)}`,
				file,
				alt: "",
				preview: URL.createObjectURL(file),
			}));
			galleryItems = [...galleryItems, ...newItems];
		}
		target.value = "";
	};

	const removeGalleryItem = (index: number) => {
		const item = galleryItems[index];
		if (item.file) URL.revokeObjectURL(item.preview);
		galleryItems = galleryItems.filter((_, i) => i !== index);
	};

	const moveItem = (index: number, dir: number) => {
		if (index + dir < 0 || index + dir >= galleryItems.length) return;
		const items = [...galleryItems];
		const temp = items[index];
		items[index] = items[index + dir];
		items[index + dir] = temp;
		galleryItems = items;
	};

	const submitForm = async (e?: SubmitEvent) => {
		e?.preventDefault();
		const finalTitle = title.trim() || `${make} ${model} ${year}`;
		isLoading = true;
		statusMessage = "";
		errorMessage = "";
		successMessage = "";

		try {
			// Step 1: Upload new images if any
			const newFiles = galleryItems.filter((item) => item.file).map((item) => item.file as File);
			let uploadedUrls: string[] = [];

			if (newFiles.length > 0) {
				statusMessage = `Mengompresi foto (0/${newFiles.length})...`;
				const { compressed, totalBytes } = await compressCarImages(newFiles, (current, total) => {
					statusMessage = `Mengompresi foto (${current}/${total})...`;
				});

				const mbFormatted = (totalBytes / (1024 * 1024)).toFixed(1);
				statusMessage = `Mengunggah ${compressed.length} foto (${mbFormatted} MB)...`;

				const uploadFormData = new FormData();
				compressed.forEach((f) => uploadFormData.append("file", f));

				const uploadRes = await fetch("/api/images/upload", {
					method: "POST",
					body: uploadFormData,
				});
				const uploadData = (await uploadRes.json()) as { error?: string; urls?: string[] };
				if (!uploadRes.ok) throw new Error(uploadData.error || "Gagal mengunggah foto");

				uploadedUrls = uploadData.urls || [];
			}

			// Step 2: Construct final gallery
			let newFileIndex = 0;
			const finalGallery = galleryItems.map((item) => {
				if (item.file) {
					const url = uploadedUrls[newFileIndex++];
					return { image: url, alt: item.alt };
				}
				return { image: item.url as string, alt: item.alt };
			});

			// Tax Expiration Date calculation
			let taxExpirationDate: string | null = null;
			if (taxMonth && taxYear) {
				taxExpirationDate = new Date(Number(taxYear), Number(taxMonth) - 1, 1).toISOString();
			}

			statusMessage = "Menyimpan data mobil...";

			// Step 3: Submit flattened payload
			const payload = {
				title: finalTitle,
				excerpt,
				relatedUrl,
				make,
				model,
				price,
				year,
				mileage,
				bodyType,
				fuelType,
				transmission,
				color,
				horsePower,
				engineSizeCC,
				ownershipStatus,
				plateNumber: (() => {
					const trimmed = plateNumber.trim();
					if (trimmed && !validatePlateNumber(trimmed)) {
						plateError = "Format plat nomor tidak valid (mis. B 1234 ABC)";
						throw new Error("Format plat nomor tidak valid (mis. B 1234 ABC)");
					}
					return trimmed ? formatPlateNumber(trimmed) : null;
				})(),
				isFloodFree,
				isAccidentFree,
				taxExpirationDate,
				seatingCapacity,
				gallery: finalGallery,
				hidden,
				fromTradeIn: fromTradeIn || undefined,
			};

			const url = car?.id ? `/api/cars/${car.id}` : "/api/cars";
			const method = car?.id ? "PUT" : "POST";

			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(data.error || "Gagal menyimpan kendaraan");

			const action = car?.id ? "updated" : "created";
			successMessage = `Kendaraan berhasil ${action === "created" ? "ditambahkan" : "diperbarui"}!`;
			showPopup("Berhasil!", successMessage, "success", action);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Gagal menyimpan kendaraan";
			errorMessage = message;
			showPopup("Error", message, "error");
			isLoading = false;
			statusMessage = "";
		}
	};
</script>

<div class="mx-auto mb-16 max-w-4xl space-y-8">
	<!-- Top Header Card -->
	<div
		class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8"
	>
		<div>
			<h2 class="text-2xl font-bold text-gray-900">
				{car?.id ? "Ubah Data Mobil" : "Tambah Mobil Baru"}
			</h2>
			<p class="mt-1 text-sm text-gray-500">
				{#if car?.id}
					ID Referensi: <span class="font-mono font-bold text-gray-700">{car.id}</span>
				{:else}
					Lengkapi data spesifikasi, kelengkapan surat, dan galeri foto unit inventaris.
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if hidden}
				<div
					class="rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-bold tracking-wider text-amber-800 uppercase"
				>
					Sembunyi (Draf)
				</div>
			{:else}
				<div
					class="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold tracking-wider text-emerald-800 uppercase"
				>
					Publik (Live)
				</div>
			{/if}
		</div>
	</div>

	{#if errorMessage}
		<div
			class="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 shrink-0 text-red-600"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
					clip-rule="evenodd"
				/>
			</svg>
			<span class="text-sm font-medium">{errorMessage}</span>
		</div>
	{/if}

	<form onsubmit={submitForm} class="space-y-8">
		<!-- 1. Informasi Umum & Identitas -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
			<h3
				class="mb-6 flex items-center gap-2.5 border-b border-gray-100 pb-3 text-lg font-bold text-gray-900"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-red-700"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
						clip-rule="evenodd"
					/>
				</svg>
				Informasi Umum & Identitas Unit
			</h3>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div class="col-span-1 md:col-span-2">
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Nama</label>
					<input
						type="text"
						bind:value={title}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. Porsche 911 Carrera S"
					/>
				</div>
				<div class="col-span-1 md:col-span-2">
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Deskripsi Singkat</label>
					<textarea
						rows="3"
						bind:value={excerpt}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="Ringkasan spesifikasi, kondisi istimewa, atau catatan unit..."></textarea>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700"
						>Merek <span class="text-red-600">*</span></label
					>
					<input
						type="text"
						bind:value={make}
						required
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. Porsche"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700"
						>Model <span class="text-red-600">*</span></label
					>
					<input
						type="text"
						bind:value={model}
						required
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. 911 Carrera"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700"
						>Harga (Rp) <span class="text-red-600">*</span></label
					>
					<input
						type="number"
						bind:value={price}
						required
						min="1"
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Tipe Body</label>
					<select
						bind:value={bodyType}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
					>
						<option value="SUV">SUV</option>
						<option value="Sedan">Sedan</option>
						<option value="Hatchback">Hatchback</option>
						<option value="Coupe">Coupe</option>
						<option value="Convertible">Convertible</option>
						<option value="Pickup">Pickup</option>
						<option value="MPV">MPV</option>
					</select>
				</div>

				<div class="col-span-1 border-t border-gray-100 pt-4 md:col-span-2">
					<label
						class="flex cursor-pointer items-center gap-3.5 rounded-xl border p-4 transition {hidden
							? 'border-amber-500 bg-amber-50/60 font-semibold text-amber-950 shadow-sm ring-1 ring-amber-500'
							: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
					>
						<input
							type="checkbox"
							bind:checked={hidden}
							class="size-4 shrink-0 rounded text-amber-600 accent-amber-600"
						/>
						<div>
							<span class="block text-sm font-bold text-gray-900">Sembunyikan dari Publik</span>
							<span class="mt-0.5 block text-xs text-gray-500"
								>Status draf internal, tidak tampil di katalog publik</span
							>
						</div>
					</label>
				</div>
			</div>
		</div>

		<!-- 2. Performa & Spesifikasi Mesin -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
			<h3
				class="mb-6 flex items-center gap-2.5 border-b border-gray-100 pb-3 text-lg font-bold text-gray-900"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-red-700"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
						clip-rule="evenodd"
					/>
				</svg>
				Performa & Spesifikasi Mesin
			</h3>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700"
						>Tahun Model <span class="text-red-600">*</span></label
					>
					<input
						type="number"
						bind:value={year}
						required
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700"
						>Jarak Tempuh (km) <span class="text-red-600">*</span></label
					>
					<input
						type="number"
						bind:value={mileage}
						required
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Tenaga (PS)</label>
					<input
						type="number"
						bind:value={horsePower}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. 385"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700"
						>Kapasitas Mesin (cc)</label
					>
					<input
						type="number"
						bind:value={engineSizeCC}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. 2981"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Transmisi</label>
					<select
						bind:value={transmission}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
					>
						<option value="Automatic">Matic</option>
						<option value="Manual">Manual</option>
						<option value="Dual-Clutch">Dual-Clutch</option>
						<option value="CVT">CVT</option>
					</select>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Bahan Bakar</label>
					<select
						bind:value={fuelType}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
					>
						<option value="Petrol">Bensin</option>
						<option value="Diesel">Solar</option>
						<option value="Hybrid">Hybrid</option>
						<option value="Electric">Listrik</option>
					</select>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Warna Eksterior</label>
					<input
						type="text"
						bind:value={color}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. Hitam Metalik"
					/>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">Kapasitas Penumpang</label
					>
					<input
						type="number"
						bind:value={seatingCapacity}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. 5 atau 7"
					/>
				</div>
			</div>
		</div>

		<!-- 3. Status Kepemilikan & Legalitas -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
			<h3
				class="mb-6 flex items-center gap-2.5 border-b border-gray-100 pb-3 text-lg font-bold text-gray-900"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-red-700"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
						clip-rule="evenodd"
					/>
				</svg>
				Status Kepemilikan, Legalitas & Kondisi Fisik
			</h3>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<div class="col-span-1 md:col-span-2">
					<span class="mb-2 block text-sm font-semibold text-gray-700">
						Status Kepemilikan / BPKB <span class="text-red-600">*</span>
					</span>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
						{#each ownershipStatuses as status (status)}
							<label
								class="flex h-full cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition {ownershipStatus ===
								status
									? 'border-red-600 bg-red-50/50 font-semibold text-red-950 shadow-sm ring-1 ring-red-600'
									: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
							>
								<input
									type="radio"
									bind:group={ownershipStatus}
									value={status}
									class="size-4 shrink-0 text-red-700 accent-red-700"
								/>
								<span class="text-xs leading-snug sm:text-sm"
									>{ownershipStatusMap[status] || status}</span
								>
							</label>
						{/each}
					</div>
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700" for="plateNumber">
						Nomor Polisi
					</label>
					<input
						type="text"
						id="plateNumber"
						bind:value={plateNumber}
						onblur={handlePlateBlur}
						oninput={handlePlateInput}
						class="w-full border px-4 py-2.5 {plateError
							? 'border-red-500 ring-1 ring-red-500'
							: 'border-gray-300'} rounded-xl bg-white text-sm uppercase transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="mis. B 1234 ABC"
					/>
					{#if plateError}
						<p class="mt-1.5 text-xs font-medium text-red-600">{plateError}</p>
					{:else}
						<p class="mt-1 text-xs text-gray-400">
							Nomor polisi internal / STNK (mis. B 1234 ABC).
						</p>
					{/if}
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-semibold text-gray-700">
						Masa Berlaku Pajak (Status Pajak STNK)
					</label>
					<div class="grid grid-cols-2 gap-3">
						<select
							bind:value={taxMonth}
							class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						>
							<option value="">- Bulan (-) -</option>
							{#each months as m (m.value)}
								<option value={m.value}>{m.label}</option>
							{/each}
						</select>
						<select
							bind:value={taxYear}
							class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						>
							<option value="">- Tahun (-) -</option>
							{#each years as y (y)}
								<option value={y.toString()}>{y}</option>
							{/each}
						</select>
					</div>
					<p class="mt-1 text-xs text-gray-400">
						Kosongkan jika belum diketahui atau masih dalam proses.
					</p>
				</div>

				<div class="col-span-1 border-t border-gray-100 pt-4 md:col-span-2">
					<span class="mb-3 block text-sm font-semibold text-gray-700">
						Sertifikasi & Kondisi Khusus Kendaraan
					</span>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<!-- 1. Kondisi Banjir (First) -->
						<label
							class="flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition {isFloodFree
								? 'border-emerald-600 bg-emerald-50/50 font-semibold text-emerald-950 shadow-sm ring-1 ring-emerald-600'
								: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
						>
							<input
								type="checkbox"
								bind:checked={isFloodFree}
								class="mt-0.5 size-4 shrink-0 rounded text-emerald-700 accent-emerald-700"
							/>
							<div>
								<span class="block text-sm font-bold text-gray-900">Bukan Bekas Banjir</span>
								<span class="mt-0.5 block text-xs leading-relaxed text-gray-500">
									{isFloodFree
										? "Unit terverifikasi aman dan tidak memiliki riwayat terendam banjir"
										: "Centang jika unit terverifikasi aman dan bebas dari riwayat terendam banjir"}
								</span>
							</div>
						</label>

						<!-- 2. Kondisi Lakalantas (Second) -->
						<label
							class="flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition {isAccidentFree
								? 'border-emerald-600 bg-emerald-50/50 font-semibold text-emerald-950 shadow-sm ring-1 ring-emerald-600'
								: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}"
						>
							<input
								type="checkbox"
								bind:checked={isAccidentFree}
								class="mt-0.5 size-4 shrink-0 rounded text-emerald-700 accent-emerald-700"
							/>
							<div>
								<span class="block text-sm font-bold text-gray-900">Bebas Lakalantas</span>
								<span class="mt-0.5 block text-xs leading-relaxed text-gray-500">
									{isAccidentFree
										? "Struktur rangka dan bodi unit utuh, bebas dari insiden tabrakan besar"
										: "Centang jika rangka dan bodi unit bebas dari riwayat tabrakan atau insiden besar"}
								</span>
							</div>
						</label>
					</div>
				</div>
			</div>
		</div>

		<!-- 4. Galeri Foto & Media -->
		<div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
			<h3
				class="mb-6 flex items-center gap-2.5 border-b border-gray-100 pb-3 text-lg font-bold text-gray-900"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-red-700"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
						clip-rule="evenodd"
					/>
				</svg>
				Galeri Foto & Media
			</h3>

			<div class="space-y-6">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					{#each galleryItems as item, idx (item.id)}
						<div
							class="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-xs transition hover:shadow-sm"
						>
							{#if idx === 0}
								<div
									class="absolute top-2 left-2 z-10 rounded-md bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white uppercase shadow-xs"
								>
									Cover
								</div>
							{/if}
							<div class="relative h-36 flex-shrink-0 bg-gray-100">
								<img src={item.preview} alt="" class="h-full w-full object-cover" />

								<div
									class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 p-2 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100"
								>
									<button
										type="button"
										class="rounded-lg bg-white/95 p-2 text-gray-800 shadow-sm transition hover:bg-white disabled:opacity-40"
										onclick={() => moveItem(idx, -1)}
										disabled={idx === 0}
										title="Pindah ke kiri"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15 19l-7-7 7-7"
											/>
										</svg>
									</button>
									<button
										type="button"
										class="rounded-lg bg-red-600/95 p-2 text-white shadow-sm transition hover:bg-red-700"
										onclick={() => removeGalleryItem(idx)}
										title="Hapus foto"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
									<button
										type="button"
										class="rounded-lg bg-white/95 p-2 text-gray-800 shadow-sm transition hover:bg-white disabled:opacity-40"
										onclick={() => moveItem(idx, 1)}
										disabled={idx === galleryItems.length - 1}
										title="Pindah ke kanan"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 5l7 7-7 7"
											/>
										</svg>
									</button>
								</div>
							</div>
							<div class="border-t border-gray-200 bg-white p-2.5">
								<input
									type="text"
									bind:value={item.alt}
									placeholder="Alt text (opsional)"
									class="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-xs transition outline-none hover:border-gray-300 focus:border-red-600 focus:bg-white"
								/>
							</div>
						</div>
					{/each}

					<!-- Upload Button -->
					<div
						class="group relative flex h-full min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/70 p-4 text-center transition hover:border-red-600 hover:bg-red-50/20"
					>
						<input
							type="file"
							accept="image/*"
							multiple
							onchange={handleFileSelect}
							class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
						/>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="mx-auto mb-2 h-8 w-8 text-gray-400 transition group-hover:text-red-700"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span class="text-sm font-bold text-gray-700 transition group-hover:text-red-700">
							Tambah Foto
						</span>
						<span class="mt-0.5 text-[11px] text-gray-400">JPG, PNG, atau WebP</span>
					</div>
				</div>

				<div class="border-t border-gray-100 pt-4">
					<label class="mb-1.5 block text-sm font-semibold text-gray-700"
						>Tautan Terkait (Instagram / Media Sosial)</label
					>
					<input
						type="url"
						bind:value={relatedUrl}
						class="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm transition focus:border-red-600 focus:ring-2 focus:ring-red-600"
						placeholder="https://www.instagram.com/p/... atau tautan lainnya"
					/>
					<p class="mt-1.5 text-xs text-gray-500">
						Tautan postingan, video reel, atau ulasan unit ini di media sosial
					</p>
				</div>
			</div>
		</div>

		<!-- 5. Actions Footer Bar -->
		<div
			class="flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row"
		>
			<div class="text-xs text-gray-500 sm:text-sm">
				{#if isLoading && statusMessage}
					<span class="flex animate-pulse items-center gap-1.5 font-semibold text-red-700">
						<svg
							class="h-4 w-4 animate-spin text-red-700"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						{statusMessage}
					</span>
				{:else if !isFormValid}
					<span class="flex items-center gap-1.5 font-medium text-amber-700">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						Mohon lengkapi merek, model, tahun, harga, dan jarak tempuh.
					</span>
				{:else if galleryItems.length === 0}
					<span class="flex items-center gap-1.5 font-medium text-amber-700">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						Harap unggah minimal 1 foto kendaraan sebagai foto cover.
					</span>
				{:else}
					<span class="flex items-center gap-1.5 font-medium text-green-700">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
						Semua data wajib dan {galleryItems.length} foto siap disimpan.
					</span>
				{/if}
			</div>

			<div class="flex w-full items-center gap-3 sm:w-auto">
				<a
					href="/cars"
					class="flex-1 rounded-xl border border-gray-300 px-5 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:flex-initial"
				>
					Batal
				</a>
				<button
					type="submit"
					disabled={isLoading || !isFormValid || galleryItems.length === 0}
					class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-700 px-7 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
				>
					{#if isLoading}
						<svg
							class="h-4 w-4 animate-spin text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<span>{statusMessage || "Menyimpan..."}</span>
					{:else}
						<span>{car?.id ? "Simpan Perubahan" : "Simpan Kendaraan"}</span>
					{/if}
				</button>
			</div>
		</div>
	</form>
</div>

{#if popup.show}
	<div
		class="animate-fade-in fixed top-20 right-4 z-50 w-full max-w-sm rounded-lg border-l-4 p-4 shadow-xl md:right-8 {popup.type ===
		'success'
			? 'border-green-500 bg-white'
			: 'border-red-500 bg-white'}"
	>
		<div class="flex items-start gap-3">
			<div class="flex-1">
				<h4 class="font-bold text-gray-900">{popup.title}</h4>
				<p class="mt-1 text-sm text-gray-600">{popup.message}</p>
			</div>
			<button class="ml-auto text-gray-400 hover:text-gray-600" onclick={() => (popup.show = false)}
				>✕</button
			>
		</div>
	</div>
{/if}

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fade-in {
		animation: fadeIn 0.4s ease-out forwards;
	}
</style>

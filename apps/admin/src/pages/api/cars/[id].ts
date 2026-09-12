import type { APIRoute } from "astro";
import { getDb } from "@harka/db";
import { cars as carsTable } from "@harka/db";
import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";

export const PUT: APIRoute = async ({ request, params }) => {
	try {
		const payload = await request.json();
		const id = params.id as string;
		const db = getDb(env as any);

		const {
			general = {},
			history = {},
			title,
			excerpt,
			videoTourUrl,
			gallery,
			technical,
			efficiency,
			options,
			security,
			exterior,
			interior,
			misc,
		} = payload;

		if (
			!general.make ||
			!general.model ||
			!general.price ||
			!history.year ||
			history.mileage === undefined ||
			history.mileage === ""
		) {
			return new Response(
				JSON.stringify({ error: "Make, Model, Price, Year, and Mileage are required fields." }),
				{ status: 400 },
			);
		}

		let finalTitle = title;
		if (!finalTitle || finalTitle.trim() === "") {
			finalTitle = `${general.make} ${general.model} ${history.year}`;
		}

		// Cleanup orphaned images
		const oldCar = await db.query.cars.findFirst({ where: eq(carsTable.id, id) });
		const oldGallery = oldCar?.gallery || [];
		const newGallery = gallery || [];

		const newImageUrls = new Set(newGallery.map((g: any) => g.image));
		const orphanedImages = oldGallery.filter((g: any) => !newImageUrls.has(g.image));

		for (const img of orphanedImages) {
			const filename = img.image.split("/").pop();
			if (filename) {
				await (env as any).IMAGES_BUCKET.delete(filename).catch(console.error);
			}
		}

		const updateData = {
			title: finalTitle,
			excerpt: excerpt || null,
			videoTourUrl: videoTourUrl || null,
			gallery: gallery || null,
			general: general || null,
			history: history || null,
			technical: technical || null,
			efficiency: efficiency || null,
			options: options || null,
			security: security || null,
			exterior: exterior || null,
			interior: interior || null,
			misc: misc || null,
		};

		await db.update(carsTable).set(updateData).where(eq(carsTable.id, id));

		return new Response(JSON.stringify({ success: true, redirect: "/cars" }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || "Failed to update car" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};

export const DELETE: APIRoute = async ({ request, params }) => {
	try {
		const id = params.id as string;
		const url = new URL(request.url);
		const reason = (url.searchParams.get("reason") as "sold" | "removed" | "delete") || "removed";
		const db = getDb(env as any);

		if (reason === "delete") {
			const car = await db.query.cars.findFirst({ where: eq(carsTable.id, id) });
			if (car?.gallery && car.gallery.length > 0) {
				for (const img of car.gallery) {
					const filename = img.image.split("/").pop();
					if (filename) {
						await (env as any).IMAGES_BUCKET.delete(filename).catch(console.error);
					}
				}
			}
			await db.delete(carsTable).where(eq(carsTable.id, id));
		} else {
			// Soft delete: update deletedAt timestamp and reason
			await db
				.update(carsTable)
				.set({
					deletedAt: new Date(),
					archiveReason: reason,
				})
				.where(eq(carsTable.id, id));
		}

		return new Response(JSON.stringify({ success: true, redirect: "/cars" }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || "Failed to delete car" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};

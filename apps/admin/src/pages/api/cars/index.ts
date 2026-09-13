import type { APIRoute } from "astro";
import { getDb } from "@harka/db";
import { cars as carsTable } from "@harka/db";
import slugify from "slugify";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request }) => {
	try {
		const payload = (await request.json()) as any;

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

		const slug =
			slugify(finalTitle, { lower: true, strict: true }) + "-" + Math.floor(Math.random() * 1000);

		const insertData = {
			id: slug,
			title: finalTitle,
			videoTourUrl: videoTourUrl || null,
			excerpt: excerpt || null,
			publishDate: new Date(),
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

		const db = getDb(env as any);
		await db.insert(carsTable).values(insertData);

		return new Response(JSON.stringify({ success: true, redirect: "/cars" }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || "Failed to create car" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};

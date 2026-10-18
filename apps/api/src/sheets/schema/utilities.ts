import { Schema, SchemaTransformation } from 'effect';

export const DDMMYY = Schema.String.pipe(
	Schema.decodeTo(
		Schema.DateFromString,
		SchemaTransformation.transform({
			decode: (input) => {
				const match = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(input);

				if (!match) return 'invalid';

				const [, dd, mm, yy] = match;
				const year = 2000 + Number(yy);
				const month = Number(mm);
				const day = Number(dd);

				const date = new Date(Date.UTC(year, month - 1, day));

				if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
					return 'invalid';
				}

				return `${year}-${mm}-${dd}T00:00:00.000Z`;
			},
			encode: (iso) => {
				const date = new Date(iso);

				const dd = String(date.getUTCDate());
				const mm = String(date.getUTCMonth() + 1);
				const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');

				return `${dd}/${mm}/${yy}`;
			},
		}),
	),
);

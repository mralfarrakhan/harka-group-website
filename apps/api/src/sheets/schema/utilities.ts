import { Option, Predicate, Schema, SchemaTransformation } from 'effect';

export const DDMMYY = Schema.String.pipe(
	Schema.decodeTo(
		Schema.DateFromString,
		SchemaTransformation.transform({
			decode: (input) => {
				const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(input);

				if (!match) return 'invalid';

				const [, dd, mm, yy] = match;
				const year = 2000 + Number(yy);
				const month = Number(mm);
				const day = Number(dd);

				const date = new Date(Date.UTC(year, month - 1, day));

				if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
					return 'invalid';
				}

				return date.toISOString();
			},
			encode: (iso) => {
				const date = new Date(iso);

				const dd = String(date.getUTCDate()).padStart(2, '0');
				const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
				const yy = String(date.getUTCFullYear() % 100).padStart(2, '0');

				return `${dd}/${mm}/${yy}`;
			},
		}),
	),
);

export const RpFromString = Schema.String.pipe(
	Schema.decodeTo(
		Schema.FiniteFromString,
		SchemaTransformation.transform({
			decode: (input) => {
				const match = /^(?:Rp\s*)?(-?\d{1,3}(?:\.\d{3})*|-?\d+)$/.exec(input.trim());

				if (!match) return 'invalid';

				return match[1].replaceAll('.', '');
			},
			encode: (numStr) => numStr,
		}),
	),
);

export const OptionFromEmptyStringOr = <S extends Schema.Top>(schema: S) =>
	Schema.optional(Schema.Union([Schema.Literal(''), Schema.NullOr(schema)])).pipe(
		Schema.decodeTo(
			Schema.Option(Schema.toType(schema)),
			SchemaTransformation.transformOptional({
				decode: (oe) =>
					oe.pipe(
						Option.filter((v): v is S['Type'] => Predicate.isNotNullish(v) && v !== ''),
						Option.some,
					),
				encode: (ot) => Option.some(Option.getOrElse(Option.flatten(ot), () => '' as const)),
			}),
		),
	);



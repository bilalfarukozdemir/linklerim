/** Testler için gerçek schema.sql'i bellekte çalıştıran, D1 arayüzlü SQLite. */

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function sahteD1() {
	const vt = new DatabaseSync(":memory:");
	vt.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
	return {
		vt,
		prepare(sql) {
			let params = [];
			const ifade = {
				bind(...p) {
					params = p;
					return ifade;
				},
				async run() {
					const r = vt.prepare(sql).run(...params);
					return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
				},
				async all() {
					return { results: vt.prepare(sql).all(...params), meta: {} };
				},
			};
			return ifade;
		},
	};
}

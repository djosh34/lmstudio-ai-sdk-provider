import { describe, expect, test } from "vitest";
import {
	FAKE_UNDEFINED,
	mapBackToOriginal,
	type Explicit,
} from "./explicit-mapper";

describe("testTypescriptMapExplicity", () => {
	test("should map options", () => {
		type TestType = {
			a: string;
			b: number;
			c: boolean;
			d?: string;
			e: null | string;
			f: string | undefined;
		};

		const explicitOptions: Explicit<TestType> = {
			a: "test",
			b: 1,
			c: true,
			d: FAKE_UNDEFINED,
			e: null,
			f: undefined,
		};

		const mappedOptions = mapBackToOriginal<TestType>(explicitOptions);

		expect(mappedOptions).toEqual({
			a: "test",
			b: 1,
			c: true,
			e: null,
			f: undefined,
		});
	});
});

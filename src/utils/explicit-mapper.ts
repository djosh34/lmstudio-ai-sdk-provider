export interface FakeUndefinedHolder {
	__fakeUndefined: true;
}

export const FAKE_UNDEFINED: FakeUndefinedHolder = {
	__fakeUndefined: true,
};

export type Explicit<T> = {
	[P in keyof T]-?: T[P] | FakeUndefinedHolder;
};

export function mapBackToOriginal<T>(mapped: Explicit<T>): T {
	const keys = Object.keys(mapped) as (keyof T)[];
	const filteredKeys = keys.filter((key) => mapped[key] !== FAKE_UNDEFINED);
	const filteredMapped = filteredKeys.reduce((acc, key) => {
		acc[key] = mapped[key] as T[keyof T];
		return acc;
	}, {} as T);
	return filteredMapped;
}

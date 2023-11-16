import { Event } from 'src';

export function mergeAndSortArrays(array1: Event[], array2: Event[]) {
	const combinedArray = [...array1, ...array2];
	combinedArray.sort((a, b) => {
		if (a.exactDate && b.exactDate) {
			return a.exactDate.getTime() - b.exactDate.getTime();
		} else if (a.exactDate) {
			return -1;
		} else if (b.exactDate) {
			return 1;
		} else {
			return 0;
		}
	});
	return combinedArray;
}
export function getMonthFromString(mon: string) {
	const d = Date.parse(mon + '1, 2012');
	if (!isNaN(d)) {
		return new Date(d).getMonth() + 1;
	}
	return -1;
}

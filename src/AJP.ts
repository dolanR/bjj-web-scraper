import { Browser } from 'puppeteer';
import type { Event } from './index';
import { getMonthFromString } from './util';

export async function AJPscraper(browser: Browser, url: string) {
	console.log(`Starting AJP Scraper...`);
	const page = await browser.newPage();
	console.log(`Navigating to ${url}...`);
	await page.goto(url);
	await page.waitForSelector('body > div.content > section.inverted > div > p:nth-child(5) > a');
	const data = (await page.$$eval('body > div.content > section.inverted > div > p', (events) => {
		return events.map((event) => {
			if (event.innerText.includes('LEARNING ACADEMY')) return;
			if (event.innerText.includes('FESTIVAL')) return;
			let title = '';
			const thisYear = new Date().getFullYear();
			// prettier-ignore
			const nextYear = (new Date().getFullYear() + 1);

			if (event.innerText.includes(thisYear + ' - GI')) {
				title = event.innerText.split(thisYear + ' - GI')[0] + thisYear + ' - GI';
			} else if (event.innerText.includes(nextYear + ' - GI')) {
				title = event.innerText.split(nextYear + ' - GI')[0] + nextYear + ' - GI';
			} else if (event.innerText.includes('YOUTH')) {
				title = event.innerText.split('YOUTH')[0] + 'YOUTH';
			} else if (event.innerText.includes('AMATEURS')) {
				title = event.innerText.split('AMATEURS')[0] + 'AMATEURS';
			} else if (event.innerText.includes('MASTERS')) {
				title = event.innerText.split('MASTERS')[0] + 'MASTERS';
			} else if (event.innerText.includes('PROFESSIONAL')) {
				title = event.innerText.split('PROFESSIONAL')[0] + 'PROFESSIONAL';
			} else {
				if (event.innerText.includes(thisYear)) {
					title = event.innerText.split(thisYear)[0] + thisYear;
				} else {
					title = event.innerText.split(nextYear)[0] + nextYear;
				}
			}

			if (title) title = title.toString().trim();
			const linkElement = event.querySelector('a');
			const link = linkElement ? linkElement.getAttribute('href').toString() : '';

			let date: string = 'N/A';
			if (linkElement && linkElement.parentElement) {
				linkElement.parentElement.removeChild(linkElement!);
				date = event.innerText.split('@')[0];
			} else {
				date = event.innerText.split(title)[1].split('@')[0];
			}
			if (date) date = date.toString().trim();
			let location = event.innerText.split('@')[1];
			location = location.toString().trim();

			const coordinates = { longitude: 0, latitude: 0 };
			return { title, date, location, link, coordinates };
		});
	})) as Event[];

	let filteredArray: Event[] = [];
	const month = new Date().getMonth() + 1;

	for (let i = 0; i < data.length; i++) {
		const event = data[i];
		if (!event) continue;

		if (!event.date || event.date === 'N/A') {
			console.warn(`Warning: No date found for AJP event at index ${i}: ${JSON.stringify(event, null, 2)}`);
			continue;
		}
		// the next year event section includes the year in the date key, so if the date contains the next year, we know it's the next year event section
		if (event.date.includes((new Date().getFullYear() + 1).toString())) {
			filteredArray = data;
			break;
		}
		let eventDate: string;
		if (event.date.includes('-')) {
			// console.log(event.date);
			eventDate = event.date.split('-')[0].trim();
		} else {
			eventDate = event.date.trim();
		}
		const eventMonth = getMonthFromString(eventDate.split(' ')[0]);
		const eventDay = parseInt(eventDate.split(' ')[1].replace('*', ''));

		// find the first event that is in the future
		if (eventMonth >= month) {
			if (eventMonth === month && eventDay < new Date().getDate()) {
				continue;
			}

			// slice array from beginning to current index
			console.log(
				`[Past-Dates-Fix] Slicing all events before index: ${i}, event date: ${event.date}, event title: ${event.title}`
			);
			filteredArray = data.slice(i);

			break;
		}
	}

	for (let i = 0; i < filteredArray.length; i++) {
		if (filteredArray[i] === null || filteredArray[i].title === null) {
			filteredArray.splice(i, 1);
			i--;
			continue;
		}
		// Getting rid of events that don't have a date, because they also don't have links
		if (filteredArray[i].date.includes('TBC')) {
			filteredArray.splice(i, 1);
			i--;
			continue;
		}
		if (filteredArray[i] && filteredArray[i]?.link) {
			const AJPEventUrl = filteredArray[i]!.link;
			if (!AJPEventUrl) {
				console.warn(`Warning: No date found for AJP event at index ${i}: ${filteredArray[i]!.title}`);
				continue;
			}
			console.log(`Navigating to ${AJPEventUrl}...`);
			await page.goto(AJPEventUrl);
			const element = await page.waitForSelector(
				'body > div.content > section > div > div > div.col-sm-4.col-sm-offset-1 > div:nth-child(3) > div > div > iframe'
			);
			if (!element) return null;
			const frame = await element.contentFrame();
			if (!frame) return null;
			const mapLink = await page.$eval(
				'body > div.content > section > div > div > div.col-sm-4.col-sm-offset-1 > div:nth-child(3) > div > div > iframe',
				(el) => el.getAttribute('src')
			);
			let longitude = parseFloat(mapLink.split('&lng=')[1].split('&')[0]);
			let latitude = parseFloat(mapLink.split('&lat=')[1].split('&')[0]);
			if (longitude === 0 && latitude === 0) {
				longitude = 26.3651875;
				latitude = -82.85201536;
			}
			if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
				longitude = 26.3651875;
				latitude = -82.85201536;
			}
			filteredArray[i]!.coordinates = { longitude, latitude };
			console.log(filteredArray[i]);
		}
		if (filteredArray[i].coordinates?.latitude === 0 && filteredArray[i].coordinates?.longitude === 0) {
			filteredArray[i].coordinates = { longitude: 26.3651875, latitude: -82.85201536 };
		}
	}
	await page.close();
	console.log(`Finished AJP Scraper.`);
	return filteredArray as Event[];
}

export function AJPDateConvert(event: Event) {
	if (event.date.includes((new Date().getFullYear() + 1).toString())) {
		if (event.date.includes('-')) {
			return new Date(event.date.split('-')[0]);
		} else {
			return new Date(event.date);
		}
	} else if (event.title.includes((new Date().getFullYear() + 1).toString())) {
		if (event.date.includes('-')) {
			return new Date(new Date().getFullYear() + 1 + ' ' + event.date.split('-')[0]);
		} else {
			return new Date(new Date().getFullYear() + 1 + ' ' + event.date);
		}
	} else {
		if (event.date.includes('-')) {
			return new Date(new Date().getFullYear() + ' ' + event.date.split('-')[0]);
		} else {
			return new Date(new Date().getFullYear() + ' ' + event.date);
		}
	}
}

import { Browser } from 'puppeteer';
import type { Event } from './main';
import { ibjjfUrl } from './main';
import { getMonthFromString } from './util';

export async function ibjjfScraper(browser: Browser) {
	console.log(`Starting IBJJF Scraper...`);
	const page = await browser.newPage();
	console.log(`Navigating to ${ibjjfUrl}...`);
	await page.goto(ibjjfUrl);
	// Wait for the required DOM to be rendered
	await page.waitForSelector('#jan');
	// Get the link to all the events
	const data = await page.$$eval('.published', (events) => {
		return events.map((event) => {
			const title = event.querySelector('.name').innerText;
			const date = event.querySelector('.date').innerText;
			const link = 'https://ibjjf.com' + event.getAttribute('href');
			const location = event.querySelector('.local').innerText;
			const coordinates = { longitude: 0, latitude: 0 };
			return { title, date, coordinates, location, link };
		});
	});

	let filteredArray: Event[] = [];
	const month = new Date().getMonth() + 1;

	for (let i = 0; i < data.length; i++) {
		const event = data[i];
		// get the current month and year
		// get the month and year of the event
		let eventDate: string;
		if (event.date.includes(' - ')) {
			// console.log(event.date);
			eventDate = event.date.split(' - ')[0];
		} else {
			eventDate = event.date;
		}

		// data here: 'Aug 4'

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
		console.log(`Navigating to ${filteredArray[i].link}...`);
		await page.goto(filteredArray[i].link!);
		const element = await page.waitForSelector('.map > iframe');
		if (!element) return null;
		const mapLink = await page.$eval('.map > iframe', (el) => el.getAttribute('src'));
		let longitude = parseFloat(mapLink.split('q=')[1].split(',')[1]);
		let latitude = parseFloat(mapLink.split('q=')[1].split(',')[0]);
		if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
			latitude = -82.85201536;
			longitude = 26.3651875;
		}
		filteredArray[i].coordinates = { longitude, latitude };
		console.log(filteredArray[i]);
	}

	await page.close();
	console.log(`Finished IBJJF Scraper.`);
	return filteredArray;
}

export function ibjjfDateConvert(event: Event) {
	// convert month to number
	const month = getMonthFromString(event.date.split(' ')[0]);
	let day = 0;
	if (event.date.includes(' - ')) {
		day = parseInt(event.date.split(' - ')[0].replace('*', '').split(' ')[1]);
	} else {
		day = parseInt(event.date.split(' ')[1].replace('*', ''));
	}
	const year = parseInt(event.title.split(' ')[event.title.split(' ').length - 1]);
	const date = new Date(year, month, day);
	return date;
}

import { Browser } from 'puppeteer';
import type { Event } from './main';
import { AGFUrl } from './main';
import { getMonthFromString } from './util';

export async function AGFScraper(browser: Browser) {
	console.log(`Starting AGF Scraper...`);
	const page = await browser.newPage();
	console.log(`Navigating to ${AGFUrl}...`);
	await page.goto(AGFUrl, { waitUntil: 'domcontentloaded' });
	const element = await page.waitForSelector('div.filter-tournaments');
	if (!element) return null;
	const data = await page.$$eval('div.event', async (events) => {
		return events.map((event) => {
			const title = event.querySelector('span.event-title').innerText;
			const month = event.querySelector('span.month').innerText;
			const day = event.querySelector('span.day').innerText;
			const year = event.querySelector('span.year').innerText;
			const date = `${month} ${day}, ${year}`;
			const location = '';
			const link = event.querySelector('div.details > table > tbody > tr > td > a').getAttribute('href');
			const coordinates = { longitude: 0, latitude: 0 };
			return { title, date, link, location, coordinates };
		});
	});
	for (let i = 0; i < data.length; i++) {
		console.log(`Navigating to ${data[i].link}...`);
		await page.goto(data[i].link!, { timeout: 0 });
		try {
			await page.waitForSelector('main.content', { timeout: 4000 });
		} catch {
			data[i].coordinates.latitude = -82.85201536;
			data[i].coordinates.longitude = 26.3651875;
			continue;
		}
		const location = await page.$eval('#app > div > div > main > div > div > p > b', (el) => el.innerText);
		data[i].location = location.replace('\n', ' ');
		//check if a selector exists for map link, if not, set coordinates to default
		let mapLink = '';
		const mapLinkExists = await page.$('#app > div > div > main > div > div > p > b > a');
		if (!mapLinkExists) {
			console.log('No map link found for', data[i].title);
			continue;
		} else {
			mapLink = await page.$eval('#app > div > div > main > div > div > p > b > a', (el) => el.getAttribute('href'));
		}
		if (!mapLink) {
			console.log('No map link found for', data[i].title);
			data[i].coordinates.latitude = -82.85201536;
			data[i].coordinates.longitude = 26.3651875;
			console.log(data[i]);
			continue;
		} else {
			await page.goto(mapLink);
			while (page.url() === mapLink) {
				await new Promise((r) => setTimeout(r, 100));
			}
			const url = page.url();
			const latitude = url.split('@')[1].split(',')[0];
			const longitude = url.split('@')[1].split(',')[1].split(',')[0];
			data[i].coordinates = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
			console.log(data[i]);
		}
	}
	await page.close();
	console.log(`Finished AGF Scraper.`);
	return data as Event[];
}

export function AGFDateConvert(event: Event) {
	// convert month to number
	const month = getMonthFromString(event.date.split(' ')[0]);
	let day = 0;
	if (event.date.includes(' - ')) {
		day = parseInt(event.date.split(' - ')[0].replace('*', '').split(' ')[1]);
	} else {
		day = parseInt(event.date.split(' ')[1].replace('*', '').split(',')[0]);
	}
	const year = parseInt(event.date.split(',')[1].trim());
	const date = new Date(year, month - 1, day);
	return date;
}

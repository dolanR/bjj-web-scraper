import { Browser } from 'puppeteer';
import type { Event } from './main';
import { ADCCUrl } from './main';

export async function ADCCScraper(browser: Browser) {
	console.log(`Starting ADCC Scraper...`);
	const page = await browser.newPage();
	console.log(`Navigating to ${ADCCUrl}...`);
	await page.goto(ADCCUrl, { waitUntil: 'domcontentloaded' });
	const element = await page.waitForSelector('div.rw-list-container > article');
	if (!element) return null;
	const data = await page.$$eval('div.rw-list-container > article', async (events) => {
		return events.map((event) => {
			const title = event.querySelector('div.rw-event-details.align-items-center > div > h2').innerText;
			const date = event.querySelector('div.rw-event-date.align-items-center > div').innerText;
			const location = event.querySelector(
				'div.rw-event-details.align-items-center > div > p.rw-event-location'
			).innerText;
			const link = event.querySelector('div.rw-event-button.align-items-center > a').getAttribute('href');
			const coordinates = { longitude: 0, latitude: 0 };
			return { title, date, location, link, coordinates };
		});
	});
	console.log(data);

	for (let i = 0; i < data.length; i++) {
		console.log(`Navigating to ${data[i].link}...`);
		await page.goto(data[i].link!);
		try {
			await page.waitForSelector(
				'div.rw-event-heading.fl-row-full-width > div > div.rw-event-heading-left.col-md-8 > div.rw-event-heading-map > iframe',
				{ timeout: 4000 }
			);
		} catch {
			data[i].coordinates.latitude = -82.85201536;
			data[i].coordinates.longitude = 26.3651875;
			continue;
		}
		const mapLink = await page.$eval(
			'div.rw-event-heading.fl-row-full-width > div > div.rw-event-heading-left.col-md-8 > div.rw-event-heading-map > iframe',
			(el) => el.getAttribute('src')
		);
		let longitude = parseFloat(mapLink.split('!2d')[1].split('!3d')[0]);
		let latitude = parseFloat(mapLink.split('!3d')[1].split('!')[0]);
		if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
			latitude = -82.85201536;
			longitude = 26.3651875;
		}
		data[i].coordinates = { longitude, latitude };
		console.log(data[i]);
	}

	await page.close();
	console.log(`Finished ADCC Scraper.`);
	return data as Event[];
}

export function ADCCDateConvert(event: Event) {
	return new Date(event.date);
}

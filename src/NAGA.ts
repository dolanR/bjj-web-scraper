import { Browser } from 'puppeteer';
import type { Event } from './main';

export async function NAGAScraper(browser: Browser, url: string) {
	console.log(`Starting NAGA Scraper...`);
	const page = await browser.newPage();
	console.log(`Navigating to ${url}...`);
	await page.goto(url);
	// Wait for the required DOM to be rendered
	await page.waitForSelector('.tribe-events-calendar-list');
	// Get the link to all the events
	const data = await page.$$eval(
		'body > div.tribe-common.tribe-events.tribe-events-view.tribe-events-view--list.alignwide.tribe-common--breakpoint-xsmall > div > div.tribe-events-calendar-list > div > div.tribe-events-calendar-list__event-wrapper.tribe-common-g-col',
		(events) => {
			return events.map((event) => {
				const date = event.querySelector('time').innerText.split('@')[0].trim();
				const title = event.querySelector('h3').innerText;
				const link = event.querySelector('h3 > a').getAttribute('href');
				const location = event.querySelector('address').innerText;
				const coordinates = { longitude: 0, latitude: 0 };
				return { title, date, location, link, coordinates };
			});
		}
	);

	for (let i = 0; i < data.length; i++) {
		const NAGAEventUrl = data[i].link;
		if (!NAGAEventUrl) continue;
		console.log(`Navigating to ${NAGAEventUrl}...`);
		await page.goto(NAGAEventUrl, { waitUntil: 'domcontentloaded' });
		const element = await page.waitForSelector('div.event-meta > div.tribe-events-venue-map > iframe');
		if (!element) return null;
		const frame = await element.contentFrame();
		if (!frame) return null;
		await element.scrollIntoView();
		await frame.waitForSelector(
			'#mapDiv > div > div > div:nth-child(5) > div > div > div > div > div.google-maps-link > a'
		);
		await element.scrollIntoView();
		const mapLink = await frame.$eval(
			'#mapDiv > div > div > div:nth-child(5) > div > div > div > div > div.google-maps-link > a',
			(el) => el.getAttribute('href')
		);
		let longitude = parseFloat(mapLink.split('ll=')[1].split('&z=')[0].split(',')[1]);
		let latitude = parseFloat(mapLink.split('ll=')[1].split('&z=')[0].split(',')[0]);
		if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
			latitude = -82.85201536;
			longitude = 26.3651875;
		}
		data[i].coordinates = { longitude, latitude };
		console.log(data[i]);
	}
	console.log(`Finished NAGA Scraper.`);
	return data as Event[];
}

export function NAGADateConvert(event: Event) {
	if (event.date.includes((new Date().getFullYear() + 1).toString())) return new Date(event.date);
	else return new Date(new Date().getFullYear() + ' ' + event.date);
}

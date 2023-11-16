import { Browser } from 'puppeteer';
import { giUrl } from 'src';
import { Event } from 'src';

export async function giScraper(browser: Browser) {
	console.log(`Starting GI Scraper...`);
	const page = await browser.newPage();
	console.log(`Navigating to ${giUrl}...`);
	await page.goto(giUrl);
	// Wait for the required DOM to be rendered
	const elementHandle = await page.waitForSelector('iframe');
	if (!elementHandle) return null;
	const frame = await elementHandle.contentFrame();
	if (!frame) return null;
	await frame.waitForSelector('.event-item');
	// Get the link to all the events
	const data = await frame.$$eval('.event-item', (events) => {
		return events.map((event) => {
			const title = event.querySelector('h2').innerText;
			const date = event.querySelector('.date').innerText;
			const link = event.querySelector('a').getAttribute('href');
			const location = event.querySelector('.location').innerText;
			const coordinates = { longitude: 0, latitude: 0 };
			return { title, date, link, location, coordinates };
		});
	});
	for (let i = 0; i < data.length; i++) {
		const giEventUrl = data[i].link;
		console.log(`Navigating to ${giEventUrl}...`);
		await page.goto(giEventUrl);
		const element = await page.waitForSelector(
			'body > div.content > section > div > div > div.col-sm-4.col-sm-offset-1 > div:nth-child(3) > div.sc-card-body > ul > li > a'
		);
		if (!element) return null;
		const mapLink = await page.$eval(
			'body > div.content > section > div > div > div.col-sm-4.col-sm-offset-1 > div:nth-child(3) > div.sc-card-body > ul > li > a',
			(el) => el.getAttribute('href')
		);
		let longitude = parseFloat(mapLink.split('q=')[1].split(',')[1]);
		let latitude = parseFloat(mapLink.split('q=')[1].split(',')[0]);
		if (longitude === 0 && latitude === 0) {
			longitude = 26.3651875;
			latitude = -82.85201536;
		}
		data[i].coordinates = { longitude, latitude };
		console.log(data[i]);
	}

	await page.close();
	console.log(`Finished GI Scraper.`);
	return data as Event[];
}

export function giDateConvert(event: Event) {
	if (event.date.includes(' - ')) return new Date(event.date.split(' - ')[0]);
	if (event.date.split(' ').length < 3) return new Date(new Date().getFullYear() + ' ' + event.date);
	return new Date(event.date);
}

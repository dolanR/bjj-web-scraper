import { createClient } from '@libsql/client';
import 'dotenv/config';
import puppeteer, { Browser } from 'puppeteer';

console.log(process.env.LIBSQL_DB_AUTH_TOKEN);
const client = createClient({
	url: 'libsql://bjj-db-dolanr.turso.io',
	authToken: process.env.LIBSQL_DB_AUTH_TOKEN,
});

type Event = {
	title: string;
	date: string;
	location?: string;
	link?: string;
	exactDate?: Date;
	coordinates?: {
		longitude: number;
		latitude: number;
	};
};

const launchBrowser = async () => {
	console.log(`fetching`);

	let browser: Browser | null = null;
	try {
		browser = await puppeteer.launch({
			headless: 'new',
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-web-security',
				'--disable-features=IsolateOrigins,site-per-process',
			],
		});
	} catch (error) {
		console.log(error);
	}

	return browser;
};

const browserInstance = await launchBrowser();

const scrapeData = async (browserInstance: Browser) => {
	try {
		if (browserInstance === null) {
			console.log('Browser instance is null');
			return null;
		}

		const AJPData = await scraperObject.AJPscraper(browserInstance);
		const ibjjfData = await scraperObject.ibjjfScraper(browserInstance);
		const giData = await scraperObject.giScraper(browserInstance);
		if (ibjjfData === null || giData === null || AJPData === null) {
			console.log('No data was scraped');
			return null;
		}
		return { ibjjfData, giData };
	} catch (err) {
		console.log('Could not resolve the browser instance => ', err);
	}
};

const scraperObject = {
	ibjjfUrl: 'https://ibjjf.com/events/calendar',
	giUrl: 'https://grapplingindustries.com/events/',
	AJPUrl1: 'https://ajptour.com/en/events-1/events-calendar-2022-2023',
	AJPUrl2: 'https://ajptour.com/en/events-1/events-calendar-2023-2024',

	async ibjjfScraper(browser: Browser) {
		const page = await browser.newPage();
		console.log(`Navigating to ${this.ibjjfUrl}...`);
		await page.goto(this.ibjjfUrl);
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
				console.log('slicing at index: ' + i);
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
		return filteredArray;
	},

	async giScraper(browser: Browser) {
		const page = await browser.newPage();
		console.log(`Navigating to ${this.giUrl}...`);
		await page.goto(this.giUrl);
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
			console.log(mapLink);
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
		return data as Event[];
	},

	async AJPscraper(browser: Browser) {
		const page = await browser.newPage();
		console.log(`Navigating to ${this.AJPUrl1}...`);
		await page.goto(this.AJPUrl1);
		await page.waitForSelector('body > div.content > section.inverted > div > p:nth-child(5) > a');
		const data = await page.$$eval('body > div.content > section.inverted > div > p', (events) => {
			return events.map((event) => {
				if (event.innerText.includes('LEARNING ACADEMY')) return;
				let title = '';
				if (event.innerText.includes(new Date().getFullYear() + ' - GI')) {
					title = event.innerText.split(new Date().getFullYear() + ' - GI')[0] + new Date().getFullYear() + ' - GI';
				} else if (event.innerText.includes('YOUTH')) {
					title = event.innerText.split('YOUTH')[0] + 'YOUTH';
				} else if (event.innerText.includes('MASTERS')) {
					title = event.innerText.split('MASTERS')[0] + 'MASTERS';
				} else if (event.innerText.includes('PROFESSIONAL')) {
					title = event.innerText.split('PROFESSIONAL')[0] + 'PROFESSIONAL';
				} else {
					title = event.innerText.split(new Date().getFullYear())[0] + new Date().getFullYear();
				}
				const date = event.innerText.split(' @ ')[0].split(title)[1];
				const linkElement = event.querySelector('a');
				const link = linkElement ? event.querySelector('a').getAttribute('href') : undefined;
				return { title, date, link };
			});
		});
		console.log(data);
	},
};

if (browserInstance) {
	const dataObject = await scrapeData(browserInstance);
	await browserInstance.close();
	if (dataObject) {
		for (let i = 0; i < dataObject.ibjjfData.length; i++) {
			const event = dataObject.ibjjfData[i];
			event.exactDate = ibjjfDateConvert(event);
		}
		for (let i = 0; i < dataObject.giData.length; i++) {
			const event = dataObject.giData[i];
			event.exactDate = giDateConvert(event);
		}
		const finalArray = mergeAndSortArrays(dataObject.ibjjfData, dataObject.giData);
		for (let i = 0; i < finalArray.length; i++) {
			// Loop over each event and detect if two events have the same latitude and longitude, if so, add a small amount to the longitude
			const event = finalArray[i];
			for (let j = 0; j < finalArray.length; j++) {
				if (i === j) continue;
				const otherEvent = finalArray[j];
				if (
					Math.abs(event.coordinates!.latitude - otherEvent.coordinates!.latitude) < 0.001 &&
					Math.abs(event.coordinates!.longitude - otherEvent.coordinates!.longitude) < 0.001
				) {
					event.coordinates!.longitude += 0.015;
				}
			}
		}
		console.log(finalArray);
		try {
			const rs = await client.execute('delete from events');
		} catch (e) {
			console.error(e);
		}
		try {
			for (let i = 0; i < finalArray.length; i++) {
				if (finalArray[i].coordinates === undefined) console.log(finalArray[i]);
				if (Number.isNaN(finalArray[i].coordinates?.latitude) || Number.isNaN(finalArray[i].coordinates?.longitude))
					console.log(finalArray[i]);
				if (finalArray[i].coordinates?.latitude === 0 || finalArray[i].coordinates?.longitude === 0)
					console.log(finalArray[i]);
			}
			for (let i = 0; i < finalArray.length; i++) {
				const rss = await client.execute({
					sql: 'insert into events ( title, date, location, link, exactDate, longitude, latitude ) values ( :title, :date, :location, :link, :exactDate, :longitude, :latitude )',
					args: {
						title: finalArray[i].title,
						date: finalArray[i].date,
						location: finalArray[i].location!,
						link: finalArray[i].link!,
						exactDate: finalArray[i].exactDate!.toISOString(),
						longitude: finalArray[i].coordinates!.longitude,
						latitude: finalArray[i].coordinates!.latitude,
					},
				});
			}
			console.log('Finished inserting data');
		} catch (error) {
			console.log(error);
		}
	}
}
function mergeAndSortArrays(array1: Event[], array2: Event[]) {
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
function getMonthFromString(mon: string) {
	const d = Date.parse(mon + '1, 2012');
	if (!isNaN(d)) {
		return new Date(d).getMonth() + 1;
	}
	return -1;
}

function ibjjfDateConvert(event: Event) {
	// convert month to number
	const month = getMonthFromString(event.date.split(' ')[0]);
	const day = parseInt(event.date.split(' ')[1].replace('*', ''));
	const year = parseInt(event.title.split(' ')[event.title.split(' ').length - 1]);
	const date = new Date(`${month} ${day} ${year}`);
	return date;
}
function giDateConvert(event: Event) {
	if (event.date.includes(' - ')) return new Date(event.date.split(' - ')[0]);
	if (event.date.split(' ').length < 3) return new Date(new Date().getFullYear() + ' ' + event.date);
	return new Date(event.date);
}

import puppeteer, { Browser } from 'puppeteer';
import { createClient } from '@libsql/client';
import 'dotenv/config';

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
	let browser;
	try {
		browser = await browserInstance;
		const ibjjfData = await scraperObject.ibjjfScraper(browser);
		const giData = await scraperObject.giScraper(browser);
		if (ibjjfData === null || giData === null) {
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

		/*
      Example event data:
      ```
      {
        title: "May 6 - May 7",
        date: "Denver International Open IBJJF Jiu-Jitsu No-Gi Championship 2023",
        location: "Regis University, Denver"
	}, {
		title: "May 7",
        date: "Atlanta Spring Kids International Open IBJJF Jiu-Jitsu Championship 2023",
        location: "Georgia International Convention Center, College Park"
	}, {
        title: "May 13 - May 14",
        date: "Houston International Open IBJJF Jiu-Jitsu Championship 2023",
        location: "1 NRG Park, Houston"
	}
	```
    */

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
			let longitude = parseFloat(mapLink.split('q=')[1].split(',')[0]);
			let latitude = parseFloat(mapLink.split('q=')[1].split(',')[1]);
			if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
				latitude = 0;
				longitude = 0;
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
			const longitude = parseFloat(mapLink.split('q=')[1].split(',')[0]);
			const latitude = parseFloat(mapLink.split('q=')[1].split(',')[1]);
			data[i].coordinates = { longitude, latitude };
			console.log(data[i]);
		}

		await page.close();
		return data as Event[];
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

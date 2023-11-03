import puppeteer, { Browser } from 'puppeteer';

type Event = {
	title: string;
	date: string;
	location: string;
	exactDate?: Date;
};

const launchBrowser = async () => {
	console.log(`fetching`);

	let browser: Browser | null = null;
	try {
		browser = await puppeteer.launch({
			headless: 'new',
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
		const data = await page.$$eval('.event-row', (events) => {
			return events.map((event) => {
				const title = event.querySelector('.name').innerText;
				const date = event.querySelector('.date').innerText;
				const location = event.querySelector('.local').innerText;
				return { title, date, location };
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

		console.log(filteredArray);

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
				const location = event.querySelector('.location').innerText;
				return { title, date, location };
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
		console.log(data);
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

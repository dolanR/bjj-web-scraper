import puppeteer, { Browser } from 'puppeteer';

type Event = {
	title: string;
	date: string;
	location: string;
};

const launchBrowser = async () => {
	console.log(`fetching`);

	let browser: Browser | null = null;
	try {
		browser = await puppeteer.launch({
			headless: false,
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
		await scraperObject.scraper(browser);
	} catch (err) {
		console.log('Could not resolve the browser instance => ', err);
	}
};

const scraperObject = {
	url: 'https://ibjjf.com/events/calendar',
	async scraper(browser: Browser) {
		const page = await browser.newPage();
		console.log(`Navigating to ${this.url}...`);
		await page.goto(this.url);
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

		// console.log(data);

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
	},
};

if (browserInstance) {
	await scrapeData(browserInstance);
	await browserInstance.close();
}

function getMonthFromString(mon: string) {
	const d = Date.parse(mon + '1, 2012');
	if (!isNaN(d)) {
		return new Date(d).getMonth() + 1;
	}
	return -1;
}

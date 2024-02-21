import { createClient } from '@libsql/client';
import 'dotenv/config';
import puppeteer, { Browser } from 'puppeteer';
import { AJPDateConvert, AJPscraper } from './AJP.ts';
import { giDateConvert, giScraper } from './GI.ts';
import { ibjjfDateConvert, ibjjfScraper } from './IBJJF.ts';
import { mergeAndSortArrays } from './util.ts';
import { NAGADateConvert, NAGAScraper } from './NAGA.ts';
import { ADCCDateConvert, ADCCScraper } from './ADCC.ts';
import { AGFScraper, AGFDateConvert } from './AGF.ts';

export const ibjjfUrl = 'https://ibjjf.com/events/calendar';
export const giUrl = 'https://grapplingindustries.com/events/';
export const ADCCUrl = 'https://adcombat.com/adcc-events/';
export const AGFUrl = 'https://www.americangrapplingfederation.com/tournaments';

const NAGAUrl1 = 'https://www.nagafighter.com/events/';
const NAGAUrl2 = 'https://www.nagafighter.com/events/list/page/2/';
const NAGAUrl3 = 'https://www.nagafighter.com/events/list/page/3/';

const AJPUrl = 'https://ajptour.com/en/events-1/events-calendar-2024';

console.log(`ENV - LIBSQL_DB_AUTH_TOKEN: ${process.env.LIBSQL_DB_AUTH_TOKEN}`);
const client = createClient({
	url: 'libsql://bjj-db-dolanr.turso.io',
	authToken: process.env.LIBSQL_DB_AUTH_TOKEN,
});

export type Event = {
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
	console.log(`Starting Browser...`);

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
		const AGFData = await AGFScraper(browserInstance);
		if (!AGFData) {
			console.log('No AGF data was scraped');
			return null;
		}
		const NAGAData1 = await NAGAScraper(browserInstance, NAGAUrl1);
		const NAGAData2 = await NAGAScraper(browserInstance, NAGAUrl2);
		const NAGAData3 = await NAGAScraper(browserInstance, NAGAUrl3);
		if (!NAGAData1 || !NAGAData2 || !NAGAData3) {
			console.log('No NAGA data was scraped');
			return null;
		}
		const NAGAData = [...NAGAData1, ...NAGAData2, ...NAGAData3];
		const ibjjfData = await ibjjfScraper(browserInstance);
		const ADCCData = await ADCCScraper(browserInstance);
		if (!ADCCData) {
			console.log('No ADCC data was scraped');
			return null;
		}
		const AJPData = await AJPscraper(browserInstance, AJPUrl);
		if (!AJPData) {
			console.log('No AJP data was scraped');
			return null;
		}
		const giData = await giScraper(browserInstance);
		if (!ibjjfData || !giData || !AJPData) {
			console.log('No IBJJF data was scraped');
			return null;
		}
		return { AGFData, ADCCData, NAGAData, AJPData, ibjjfData, giData };
	} catch (err) {
		console.log('Could not resolve the browser instance => ', err);
	}
};

if (browserInstance) {
	const dataObject = await scrapeData(browserInstance);
	await browserInstance.close();
	console.log(`Finished scraping data. Starting date conversions and sorting...`);
	if (dataObject) {
		// Convert all the exact dates to Date objects
		for (let i = 0; i < dataObject.AGFData.length; i++) {
			const event = dataObject.AGFData[i];
			event.exactDate = AGFDateConvert(event);
		}
		for (let i = 0; i < dataObject.ADCCData.length; i++) {
			const event = dataObject.ADCCData[i];
			event.exactDate = ADCCDateConvert(event);
		}
		for (let i = 0; i < dataObject.NAGAData.length; i++) {
			const event = dataObject.NAGAData[i];
			event.exactDate = NAGADateConvert(event);
		}
		for (let i = 0; i < dataObject.AJPData.length; i++) {
			const event = dataObject.AJPData[i];
			event.exactDate = AJPDateConvert(event);
		}
		for (let i = 0; i < dataObject.ibjjfData.length; i++) {
			const event = dataObject.ibjjfData[i];
			event.exactDate = ibjjfDateConvert(event);
		}
		for (let i = 0; i < dataObject.giData.length; i++) {
			const event = dataObject.giData[i];
			event.exactDate = giDateConvert(event);
		}
		// Merge and sort all the arrays using the function in util
		const finalArray = mergeAndSortArrays(
			dataObject.ADCCData,
			mergeAndSortArrays(
				dataObject.NAGAData,
				mergeAndSortArrays(
					dataObject.AJPData,
					mergeAndSortArrays(dataObject.ibjjfData, mergeAndSortArrays(dataObject.giData, dataObject.AGFData))
				)
			)
		);
		for (let i = 0; i < finalArray.length; i++) {
			// Loop over each event and detect if two events have the same latitude and longitude, or a very close latitude and longitude, if so, add a small amount to the longitude
			const event = finalArray[i];
			for (let j = 0; j < finalArray.length; j++) {
				if (i === j) continue;
				const otherEvent = finalArray[j];
				if (
					Math.abs(event.coordinates!.latitude - otherEvent.coordinates!.latitude) < 0.03 ||
					Math.abs(event.coordinates!.longitude - otherEvent.coordinates!.longitude) < 0.03
				) {
					event.coordinates!.longitude += 0.03;
					event.coordinates!.latitude += 0.03;
				}
			}
		}

		console.log(finalArray);
		console.log(`Finished date conversions and sorting. Starting to insert data...`);
		try {
			console.log('Clearing events table in database...');
			await client.execute('delete from events');
			console.log('Events table cleared.');
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
			console.log('Inserting data into database...');
			for (let i = 0; i < finalArray.length; i++) {
				//Check to see if the event exact date is invalid, if so, skip it
				if (finalArray[i].exactDate!.toString() === 'Invalid Date') {
					console.log(`Skipping event at index ${i}: ${finalArray[i].title}`);
					continue;
				}
				await client.execute({
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

import * as cheerio from 'cheerio';

export async function fetchHtml(url: string): Promise<string> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10_000);

	try {
		const response = await fetch(url, {
			headers: {
				      'User-Agent': 'Verifis/0.1 (+https://verifis.app)',
			},
			redirect: 'follow',
			signal: controller.signal,
		});

		if (!response.ok) {
			const error: any = new Error(`HTTP ${response.status}`);
			error.status = response.status;
			throw error;
		}

		return await response.text();
	} catch (err) {
		throw err;
	} finally {
		clearTimeout(timeoutId);
	}
}

export function extractReadableText(html: string): string {
	const $ = cheerio.load(html);
	const article = $('article').text();
	const main = $('main').text();
	const body = $('body').text();
	const raw = article?.trim().length ? article : main?.trim().length ? main : body;
	const collapsed = raw.replace(/\s+/g, ' ').trim();
	return collapsed.slice(0, 20_000);
}



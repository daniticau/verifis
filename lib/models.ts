import { createOpenAI } from '@ai-sdk/openai';

export function getOpenAI() {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error('Missing OPENAI_API_KEY environment variable');
	}
	return createOpenAI({ apiKey });
}



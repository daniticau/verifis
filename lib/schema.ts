import { z } from 'zod';

export const ClaimsSchema = z.object({
	claims: z
		.array(
			z.object({
				claim: z.string().min(6),
				quote: z.string().optional(),
				confidence: z.number().min(0).max(1).default(0.5),
			})
		)
		.max(8),
});

export type Claim = z.infer<typeof ClaimsSchema>['claims'][number];
export type ClaimsResponse = z.infer<typeof ClaimsSchema>;

export const FeedbackSchema = z.object({
	url: z.string().url(),
	claim: z.string().min(6),
	vote: z.enum(['up', 'down']),
	note: z.string().optional(),
});

export type FeedbackRequest = z.infer<typeof FeedbackSchema>;



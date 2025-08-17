"use client";

import { ThumbsDown, ThumbsUp } from 'lucide-react';

type ClaimData = { claim: string; quote?: string; confidence: number };

export default function ClaimCard({
	data,
	onVote,
}: {
	data: ClaimData;
	onVote?: (vote: 'up' | 'down') => void;
}) {
	return (
		<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
			<div className="mb-2 font-semibold text-gray-900">{data.claim}</div>
			{data.quote ? (
				<div className="mb-2 text-sm text-gray-600">“{data.quote}”</div>
			) : null}
			<div className="mb-3 text-sm text-gray-700">Confidence: {(data.confidence * 100).toFixed(0)}%</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
					onClick={() => onVote?.('up')}
					aria-label="Upvote"
				>
					<ThumbsUp className="h-4 w-4" />
					<span>Upvote</span>
				</button>
				<button
					type="button"
					className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
					onClick={() => onVote?.('down')}
					aria-label="Downvote"
				>
					<ThumbsDown className="h-4 w-4" />
					<span>Downvote</span>
				</button>
			</div>
		</div>
	);
}



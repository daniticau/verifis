"use client";

import { useEffect, useMemo, useState } from 'react';
import Spinner from '@/components/Spinner';
import ClaimCard from '@/components/ClaimCard';
import { type Claim } from '@/lib/schema';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';

type ExtractResponse = { url: string; claims: Claim[] };

function ProofContent() {
	const [inputUrl, setInputUrl] = useState<string>('');
	const [claims, setClaims] = useState<Claim[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		try {
			const params = new URLSearchParams(window.location.search);
			const u = params.get('url');
			if (u) setInputUrl(u);
		} catch {}
	}, []);

	const extractMutation = useMutation<{ data: ExtractResponse }, Error, string>({
		mutationFn: async (url: string) => {
			const res = await fetch('/api/extract', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			return { data };
		},
		onSuccess: ({ data }) => {
			setClaims(data.claims);
			setError(null);
		},
		onError: (err) => {
			setError(err.message);
			setClaims(null);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputUrl) {
			setError('Please enter a valid URL.');
			return;
		}
		extractMutation.mutate(inputUrl);
	};

	const handleVote = async (claim: Claim, vote: 'up' | 'down') => {
		try {
			await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: inputUrl, claim: claim.claim, vote }),
			});
		} catch {}
	};

	return (
		<div className="mx-auto max-w-3xl px-4 py-8">
			<h1 className="mb-2 text-3xl font-bold">Verifis</h1>
			<p className="mb-6 text-gray-600">Every claim gets a receipt.</p>
			<form onSubmit={handleSubmit} className="mb-6 flex w-full flex-col gap-3 sm:flex-row">
				<input
					type="url"
					value={inputUrl}
					onChange={(e) => setInputUrl(e.target.value)}
					placeholder="https://example.com/article"
					className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
				/>
				<button
					type="submit"
					disabled={extractMutation.isPending}
					className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{extractMutation.isPending ? (
						<span className="inline-flex items-center gap-2"><Spinner /> Extracting…</span>
					) : (
						'Extract'
					)}
				</button>
			</form>
			{error ? (
				<div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
			) : null}
			{extractMutation.isPending && !claims ? (
				<div className="flex items-center gap-2 text-sm text-gray-600"><Spinner /> Processing…</div>
			) : null}
			{claims ? (
				<div className="grid grid-cols-1 gap-4">
					{claims.map((c, idx) => (
						<ClaimCard key={idx} data={c} onVote={(v) => handleVote(c, v)} />
					))}
				</div>
			) : null}
		</div>
	);
}

export default function Page() {
	const queryClient = useMemo(() => new QueryClient(), []);
	return (
		<QueryClientProvider client={queryClient}>
			<ProofContent />
		</QueryClientProvider>
	);
}



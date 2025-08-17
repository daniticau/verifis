"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Spinner from '@/components/Spinner';
import ClaimCard from '@/components/ClaimCard';
import { type Claim } from '@/lib/schema';

type ClipData = {
  id: string;
  url: string;
  title: string;
  text: string;
  isSnippet: boolean;
  createdAt: string;
};

type SnippetClaim = {
  claim: string;
  status: 'likely true' | 'likely false' | 'uncertain';
  confidence: number;
  justification: string;
};

export default function OverlayPage() {
  const searchParams = useSearchParams();
  const clipId = searchParams.get('id');
  const snippetText = searchParams.get('text');
  
  const [clip, setClip] = useState<ClipData | null>(null);
  const [claims, setClaims] = useState<SnippetClaim[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clip data
  useEffect(() => {
    if (!clipId) return;

    async function loadClip() {
      try {
        const response = await fetch(`/api/clip?id=${clipId}`);
        if (!response.ok) throw new Error('Clip not found');
        
        const clipData = await response.json();
        setClip(clipData);
        
        // Auto-extract claims for snippets
        if (clipData.isSnippet && clipData.text.length < 2000) {
          extractClaims(clipData.text);
        }
      } catch (err) {
        setError('Failed to load clip');
      }
    }

    loadClip();
  }, [clipId]);

  // Extract claims for snippets
  async function extractClaims(text: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: 'snippet://verifis.clip',
          text: text,
          isSnippet: true 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data?.error || 'Extraction failed');
      }

      setClaims(data.claims);
    } catch (err: any) {
      setError(err.message || 'Failed to extract claims');
    } finally {
      setLoading(false);
    }
  }

  // Close overlay
  function closeOverlay() {
    window.parent.postMessage({ type: 'verifis-close-overlay' }, '*');
  }

  if (!clip) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {clip.title}
            </h1>
            <p className="text-sm text-gray-500 truncate">
              {clip.url}
            </p>
          </div>
          <button
            onClick={closeOverlay}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Close overlay"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Snippet Text */}
        {snippetText && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Highlighted Text</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-900 leading-relaxed">
                "{snippetText}"
              </p>
            </div>
          </div>
        )}

        {/* Full Text (if not snippet) */}
        {!clip.isSnippet && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Full Text</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-32 overflow-y-auto">
              <p className="text-sm text-gray-700 leading-relaxed">
                {clip.text}
              </p>
            </div>
          </div>
        )}

        {/* Claims Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Verification Results</h2>
            {!clip.isSnippet && (
              <button
                onClick={() => extractClaims(clip.text)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Spinner /> : 'Extract Claims'}
              </button>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
              <span className="ml-2 text-gray-600">Analyzing claims...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Claims Display */}
          {claims && claims.length > 0 && (
            <div className="space-y-4">
              {claims.map((claim, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{claim.claim}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      claim.status === 'likely true' ? 'bg-green-100 text-green-800' :
                      claim.status === 'likely false' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{claim.justification}</p>
                  <div className="text-xs text-gray-500">
                    Confidence: {(claim.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Claims State */}
          {!loading && !error && (!claims || claims.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <p>No claims extracted yet.</p>
              {!clip.isSnippet && (
                <p className="text-sm mt-1">Click "Extract Claims" to analyze the text.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Verifis v0</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}

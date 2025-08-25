"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

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

function OverlayContent() {
  const searchParams = useSearchParams();
  const clipId = searchParams.get('id');
  const snippetText = searchParams.get('text');
  
  const [clip, setClip] = useState<ClipData | null>(null);
  const [claims, setClaims] = useState<SnippetClaim[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clip data
  useEffect(() => {
    if (!clipId) {
      setError('No clip ID provided');
      return;
    }

    async function loadClip() {
      try {
        const response = await fetch(`/api/clip?id=${clipId}`);
        if (!response.ok) throw new Error('Clip not found');
        
        const clipData = await response.json();
        setClip(clipData);
        
        // Auto-extract claims for snippets (only if we have text)
        if (clipData.isSnippet && clipData.text && clipData.text.length < 2000) {
          extractClaims(clipData.text);
        }
      } catch (err: any) {
        console.error('Failed to load clip:', err);
        setError('Failed to load clip: ' + (err.message || 'Unknown error'));
      }
    }

    loadClip();
  }, [clipId]);

  // Extract claims for snippets
  async function extractClaims(text: string) {
    if (!text || text.length === 0) return;
    
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
      console.error('Failed to extract claims:', err);
      setError(err.message || 'Failed to extract claims');
    } finally {
      setLoading(false);
    }
  }

  // Close overlay
  function closeOverlay() {
    window.parent.postMessage({ type: 'verifis-close-overlay' }, '*');
  }

  // Show error state
  if (error && !clip) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', padding: '24px' }}>
        <div style={{ 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: '8px', 
          padding: '16px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#991b1b', margin: '0 0 10px 0' }}>Error</h2>
          <p style={{ color: '#991b1b', margin: 0 }}>{error}</p>
        </div>
        <button
          onClick={closeOverlay}
          style={{
            margin: '20px',
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    );
  }

  if (!clip) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
          <div style={{ 
            width: '24px', 
            height: '24px', 
            border: '2px solid #e5e7eb', 
            borderTop: '2px solid #3b82f6', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ 
        position: 'sticky', 
        top: 0, 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb', 
        padding: '16px 24px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ 
              fontSize: '18px', 
              fontWeight: 600, 
              color: '#111827', 
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {clip.title}
            </h1>
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280', 
              margin: '4px 0 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {clip.url}
            </p>
          </div>
          <button
            onClick={closeOverlay}
            style={{
              marginLeft: '16px',
              padding: '8px',
              color: '#9ca3af',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              backgroundColor: 'transparent'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#4b5563';
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#9ca3af';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Close overlay"
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {/* Snippet Text */}
        {snippetText && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#374151', margin: '0 0 8px 0' }}>Highlighted Text</h2>
            <div style={{ 
              backgroundColor: '#eff6ff', 
              border: '1px solid #bfdbfe', 
              borderRadius: '8px', 
              padding: '16px' 
            }}>
              <p style={{ fontSize: '14px', color: '#111827', lineHeight: 1.6, margin: 0 }}>
                "{snippetText}"
              </p>
            </div>
          </div>
        )}

        {/* Full Text (if not snippet) */}
        {!clip.isSnippet && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#374151', margin: '0 0 8px 0' }}>Full Text</h2>
            <div style={{ 
              backgroundColor: '#f9fafb', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              padding: '16px', 
              maxHeight: '128px', 
              overflowY: 'auto' 
            }}>
              <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.6, margin: 0 }}>
                {clip.text}
              </p>
            </div>
          </div>
        )}

        {/* Claims Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Verification Results</h2>
            {!clip.isSnippet && (
              <button
                onClick={() => extractClaims(clip.text)}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: loading ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#1d4ed8';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid #ffffff', 
                      borderTop: '2px solid transparent', 
                      borderRadius: '50%', 
                      animation: 'spin 1s linear infinite',
                      marginRight: '8px'
                    }}></div>
                    Analyzing...
                  </span>
                ) : 'Extract Claims'}
              </button>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{ 
                width: '20px', 
                height: '20px', 
                border: '2px solid #e5e7eb', 
                borderTop: '2px solid #3b82f6', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite',
                marginRight: '8px'
              }}></div>
              <span style={{ color: '#4b5563' }}>Analyzing claims...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{ 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '8px', 
              padding: '16px' 
            }}>
              <p style={{ fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Claims Display */}
          {claims && claims.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {claims.map((claim, index) => (
                <div key={index} style={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px', 
                  padding: '16px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontWeight: 500, color: '#111827', margin: 0, flex: 1, marginRight: '8px' }}>{claim.claim}</h3>
                    <span style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '9999px',
                      backgroundColor: claim.status === 'likely true' ? '#dcfce7' : 
                                    claim.status === 'likely false' ? '#fee2e2' : '#fef3c7',
                      color: claim.status === 'likely true' ? '#166534' : 
                             claim.status === 'likely false' ? '#991b1b' : '#92400e'
                    }}>
                      {claim.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '14px', color: '#4b5563', margin: '0 0 8px 0' }}>{claim.justification}</p>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Confidence: {(claim.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Claims State */}
          {!loading && !error && (!claims || claims.length === 0) && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
              <p style={{ margin: 0 }}>No claims extracted yet.</p>
              {!clip.isSnippet && (
                <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>Click "Extract Claims" to analyze the text.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        position: 'sticky', 
        bottom: 0, 
        backgroundColor: 'white', 
        borderTop: '1px solid #e5e7eb', 
        padding: '12px 24px' 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          fontSize: '12px', 
          color: '#6b7280' 
        }}>
          <span>Verifis v1.0.0</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}

export default function OverlayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ 
          width: '24px', 
          height: '24px', 
          border: '2px solid #e5e7eb', 
          borderTop: '2px solid #3b82f6', 
          borderRadius: '50%', 
          animation: 'spin 1s linear infinite' 
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    }>
      <OverlayContent />
    </Suspense>
  );
}

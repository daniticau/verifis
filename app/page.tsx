export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-4xl font-bold">Verifis</h1>
      <p className="mb-6 text-gray-600">Every claim gets a receipt.</p>
      <div className="mb-8">
        <a
          href="/proof"
          className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
        >
          Go to Proof →
        </a>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold">Bookmarklet</h2>
        <p className="mb-2 text-sm text-gray-600">Drag this to your bookmarks bar, then click it on any page:</p>
        <pre className="overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
{`javascript:(function(){
  const u=encodeURIComponent(location.href);
  window.open('https://<YOUR-DEPLOYMENT>.vercel.app/proof?url='+u,'_blank');
})();`}
        </pre>
        <p className="mt-2 text-xs text-gray-500">TODO: replace domain after first deploy.</p>
      </div>
    </main>
  );
}

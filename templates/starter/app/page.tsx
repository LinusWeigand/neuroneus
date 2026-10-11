const COPY = {
  eyebrow: "{{comingSoon}}",
  name: "{{name}}",
  vision: "{{vision}}",
  status: "{{shaping}}",
};

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center p-8">
      <div className="max-w-xl text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">{COPY.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{COPY.name}</h1>
        <p className="mt-4 text-muted">{COPY.vision}</p>
        <p className="mt-10 text-sm text-muted">{COPY.status}</p>
      </div>
    </main>
  );
}

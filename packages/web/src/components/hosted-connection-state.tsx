export function HostedConnectionState() {
  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
      <section className="bg-card flex w-full max-w-lg flex-col gap-3 border p-6">
        <h1 className="font-nav text-sm uppercase tracking-[0.14em]">
          Hosted Session Not Connected
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          This embedded UI session needs explicit <code className="bg-muted rounded px-1">api</code>{' '}
          and <code className="bg-muted rounded px-1">session</code> query parameters from the app
          shell. Open it through <code className="bg-muted rounded px-1">openspecui --app</code>{' '}
          instead of loading the backend page directly.
        </p>
      </section>
    </main>
  )
}

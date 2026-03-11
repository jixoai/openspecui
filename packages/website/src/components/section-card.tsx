import type { ReactNode } from 'react'

interface SectionCardProps {
  eyebrow?: string
  title: string
  summary?: string
  children: ReactNode
  className?: string
}

export function SectionCard({
  eyebrow,
  title,
  summary,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <section className={`border-border bg-card border shadow-md ${className}`}>
      <div className="border-border flex flex-col gap-2 border-b px-4 py-3 sm:px-5">
        {eyebrow ? (
          <p className="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">{eyebrow}</p>
        ) : null}
        <div className="flex flex-col gap-1">
          <h2 className="font-nav text-base sm:text-lg">{title}</h2>
          {summary ? <p className="text-muted-foreground text-sm leading-6">{summary}</p> : null}
        </div>
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  )
}

import type { ReactNode } from 'react'

interface SectionCardProps {
  eyebrow?: string
  title: string
  summary?: string
  children: ReactNode
  className?: string
  contentClassName?: string
  tone?: 'default' | 'hero'
}

export function SectionCard({
  eyebrow,
  title,
  summary,
  children,
  className = '',
  contentClassName = '',
  tone = 'default',
}: SectionCardProps) {
  const titleClassName =
    tone === 'hero'
      ? 'font-nav max-w-[24ch] text-balance text-[clamp(1.58rem,2.55vw,2.7rem)] tracking-tight leading-[0.96] sm:max-w-[22ch] lg:max-w-[24ch]'
      : 'font-nav text-balance text-[1.05rem] tracking-tight leading-tight sm:text-[1.22rem]'

  const summaryClassName =
    tone === 'hero'
      ? 'max-w-[62ch] text-pretty text-[13px] leading-6 text-foreground/78 sm:text-[14px] sm:leading-6'
      : 'max-w-[64ch] text-pretty text-[13px] leading-5 text-muted-foreground sm:text-[14px] sm:leading-6'

  return (
    <section className={`border-border bg-card border shadow-sm ${className}`}>
      <div className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
        {eyebrow ? (
          <p className="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">{eyebrow}</p>
        ) : null}
        <div className="flex flex-col gap-2.5">
          <h2 className={titleClassName}>{title}</h2>
          {summary ? <p className={summaryClassName}>{summary}</p> : null}
        </div>
      </div>
      <div className={`px-4 py-4 sm:px-5 sm:py-5 ${contentClassName}`.trim()}>{children}</div>
    </section>
  )
}

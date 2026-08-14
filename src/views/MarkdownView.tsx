import type { ComponentPropsWithoutRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { FileViewProps } from './registry'

/**
 * A markdown file, rendered.
 *
 * A README is whatever the user put in the store, so it is untrusted input.
 * `react-markdown` builds React elements and does not render raw HTML unless
 * `rehype-raw` is added — so **do not add it**, and do not replace the default
 * `urlTransform` with something more permissive. That is the whole safety story;
 * anything else in here is presentation.
 *
 * The only importer of `react-markdown`, so swapping the renderer is one file.
 */
export function MarkdownView({ content }: FileViewProps) {
  return (
    <article className="markdown">
      <SafeMarkdown content={content} />
    </article>
  )
}

/**
 * The renderer itself, without the file-view wrapper — for markdown that
 * isn't a tree file (e.g. a kanban card's description), which has no
 * `FileContext` to satisfy `FileViewProps`. Same safety story as above: no
 * `rehype-raw`, no loosened `urlTransform`.
 */
export function SafeMarkdown({ content }: { content: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={{ a: Link, img: Image }}>
      {content}
    </Markdown>
  )
}

/**
 * Nothing serves the project store over HTTP, so a link into it cannot resolve —
 * and a relative href is worse than dead: nginx answers an unknown path with
 * `index.html`, so following one would reload the whole app and lose everything
 * the user had open. Only links that lead somewhere real are links.
 *
 * Next step, when a project's own files can be addressed: resolve the href
 * against this file's directory and select that instead of inventing a URL.
 */
function Link({ href, title, children }: ComponentPropsWithoutRef<'a'>) {
  if (!href || !leadsSomewhere(href)) {
    return (
      <span className="markdown__unresolved" title={href}>
        {children}
      </span>
    )
  }

  // Off-site, so it must not navigate the shell away.
  const external = !href.startsWith('#')

  return (
    <a href={href} title={title} {...(external && { target: '_blank', rel: 'noreferrer noopener' })}>
      {children}
    </a>
  )
}

/** Same reasoning as `Link`: a src we cannot fetch shows its alt text instead. */
function Image({ src, alt, title }: ComponentPropsWithoutRef<'img'>) {
  if (!src || !isAbsolute(src)) {
    return (
      <span className="markdown__unresolved" title={src}>
        {alt || 'image'}
      </span>
    )
  }

  return <img src={src} alt={alt ?? ''} title={title} />
}

const isAbsolute = (url: string) => /^https?:\/\//i.test(url)

const leadsSomewhere = (href: string) =>
  isAbsolute(href) || /^mailto:/i.test(href) || href.startsWith('#')

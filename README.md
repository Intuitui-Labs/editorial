# @intuitui-labs/editorial

> **Provider-neutral, headless editorial publishing contracts, multi-format ingestion (.md, .txt, .json), Git provenance, and distribution ledger.**

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 1. What is this package?

`@intuitui-labs/editorial` is a **framework-agnostic headless editorial domain engine**. It is not tied to Astro, Next.js, or any single framework.

It provides:
1. **Multi-Format Content Ingestion**: Native parsing for **Markdown (`.md`)**, **MDX (`.mdx`)**, **Plain Text (`.txt`)**, **JSON bundles (`.json`)**, and **HTML**.
2. **Canonical Zod Schemas**: Pure validation for articles, authors, rights agreements, and distribution policies.
3. **Headless Distribution Controller**: Manages channel formatting (LinkedIn, Postiz, X/Meta, Medium, Substack), UTM parameters, excerpt truncation, and reviewer gates without UI framework lock-in.
4. **Git Provenance & Schema.org Metadata**: Automatically extracts first-commit (published) and latest-commit (modified) timestamps from Git across multiple frameworks (`src/pages`, `app/`, `pages/`, `src/routes`, `content/`).
5. **Syndication Ledger & Postiz Bridge**: Deduplicates outbound dispatches with deterministic idempotency keys (`evt-1:postiz:main`) and dispatches to Postiz, LinkedIn, or custom webhooks.
6. **Built-in Scaffolding CLI**: Generate schema-valid articles in `.md`, `.txt`, or `.json` with one command.

---

## 2. Framework-Agnostic Usage (Truly Headless)

### In Next.js (App Router / Server Components)

Validate Markdown, MDX, or Plain Text frontmatter using the canonical Zod schema:

```typescript
import { parseEditorialDocument } from '@intuitui-labs/editorial/schema';
import fs from 'fs';

export async function getArticle(slug: string) {
  const raw = fs.readFileSync(`content/journal/${slug}.md`, 'utf8');
  // Works seamlessly with .md, .txt, or .json
  const { frontmatter, body, format } = parseEditorialDocument(raw);
  return { frontmatter, body, format };
}
```

### In React / Svelte / Vue / Web Components (Headless Distribution UI)

Use the `DistributionController` to build custom social syndication panels:

```typescript
import { DistributionController } from '@intuitui-labs/editorial/controller';

const controller = new DistributionController({
  article: {
    title: 'The Architecture of Gratitude',
    summary: 'Moving beyond transactional subscriptions.',
    url: 'https://edlove.org/journal/architecture-of-gratitude',
    topics: ['economics', 'teaching'],
  },
  utmCampaign: 'journal-autumn-2026',
});

// Subscribe to reactive state updates (for React useState, Svelte rune, Vue ref):
controller.subscribe((state) => {
  console.log('Channel:', state.activeChannel);
  console.log('Post Text:', state.postText);
  console.log('Can Dispatch:', state.canDispatch); // requires isReviewed=true
});

// Reviewer signs off:
controller.setReviewed(true);

// Dispatch to Postiz or clipboard:
await controller.dispatch();
```

---

## 3. Article Scaffolding CLI

Generate schema-compliant documents in any format:

```bash
# Markdown (.md)
npx @intuitui-labs/editorial new --title "Sovereign Systems" --format md

# Plain Text (.txt)
npx @intuitui-labs/editorial new --title "Field Note" --format txt

# JSON Bundle (.json)
npx @intuitui-labs/editorial new --title "API Story" --format json
```

---

## 4. Postiz & Social Media Distribution

```typescript
import { createPostizAdapter, dispatchArticlePublished, MemoryDistributionLedger } from '@intuitui-labs/editorial';

const postiz = createPostizAdapter({
  baseUrl: process.env.POSTIZ_API_URL || 'https://postiz.your-domain.com',
  apiKey: process.env.POSTIZ_API_KEY!,
  integrationIds: ['linkedin-id', 'twitter-id'],
});

const ledger = new MemoryDistributionLedger();

const deliveries = await dispatchArticlePublished({
  event: publishedEvent,
  article: { title: 'Title', text: 'Summary' },
  accountIds: { postiz: 'main' },
  ledger,
  adapters: { postiz },
  now: new Date().toISOString(),
});
```

## Documentation
- [Testing Specifications & Evidence Protocol](docs/testing.md)
- [NPM Publishing Guide](docs/publishing.md)

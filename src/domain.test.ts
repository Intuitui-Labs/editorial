import { describe, expect, expectTypeOf, it, test } from 'vitest';
import {
  createLinkedInAdapter,
  createMemoryDispatchLedger,
  createPostizAdapter,
  dispatchArticlePublished,
  linkedinAdapter,
} from './distribution.js';
import {
  type AuthorProfile,
  canTransitionSubmission,
  createArticlePublishedEvent,
  createDelivery,
  MemoryDistributionLedger,
  type SubmissionStatus,
  transitionDelivery,
} from './domain.js';
import { articleFrontmatterSchema, parseEditorialDocument } from './schema.js';
import { DistributionController } from './distribution-controller.js';
import { scaffoldArticleDocument } from './cli.js';
import { resolvePageSourceFile } from './page-metadata.js';

const event = createArticlePublishedEvent({
  eventId: 'evt-1',
  occurredAt: '2026-08-31T00:00:00.000Z',
  workId: 'work-1',
  versionId: 'version-1',
  publication: 'edlove',
  language: 'en',
  canonicalUrl: 'https://edlove.org/journal/example',
  policy: { channels: ['linkedin'], excerptOnly: ['linkedin'], utmCampaign: 'journal-launch' },
});

describe('editorial distribution contracts', { tags: ['editorial', 'pure', 'fast'] }, () => {
  it('enforces static type boundaries on core editorial models (T16 expectTypeOf)', () => {
    expectTypeOf<AuthorProfile['displayName']>().toBeString();
    expectTypeOf<SubmissionStatus>().toEqualTypeOf<
      'submitted' | 'in_review' | 'rights_review' | 'approved' | 'rejected' | 'withdrawn'
    >();
    expectTypeOf(canTransitionSubmission).toBeFunction();
    expectTypeOf(canTransitionSubmission).parameter(0).toBeString();
  });

  it('creates stable idempotent delivery keys', () => {
    expect(createDelivery(event, 'linkedin', 'edlove-main', event.occurredAt).idempotencyKey).toBe(
      'evt-1:linkedin:edlove-main',
    );
  });

  it('allows retry after failure and increments attempts', () => {
    const delivery = createDelivery(event, 'linkedin', 'edlove-main', event.occurredAt);
    const processing = transitionDelivery(delivery, 'processing', event.occurredAt);
    const failed = transitionDelivery(processing, 'failed', event.occurredAt, {
      lastError: 'rate limited',
    });
    const retry = transitionDelivery(failed, 'processing', event.occurredAt);
    expect(retry.attempts).toBe(2);
    expect(retry.status).toBe('processing');
  });

  it('prepares channel-specific links and excerpts', () => {
    const payload = linkedinAdapter.prepare(event, { title: 'Title', text: 'x'.repeat(400) });
    expect(payload.text).toHaveLength(280);
    expect(payload.url).toContain('utm_source=linkedin');
  });

  it('deduplicates deliveries through the ledger', () => {
    const ledger = new MemoryDistributionLedger();
    const delivery = createDelivery(event, 'linkedin', 'edlove-main', event.occurredAt);
    ledger.save(delivery);
    ledger.save(delivery);
    expect(ledger.list(event.eventId)).toHaveLength(1);
  });

  it('does not claim a dry-run adapter published externally', async () => {
    const deliveries = await dispatchArticlePublished({
      event,
      article: { title: 'Title', text: 'Body' },
      accountIds: { linkedin: 'edlove-main' },
      ledger: createMemoryDispatchLedger(),
      now: event.occurredAt,
    });
    expect(deliveries[0]?.status).toBe('skipped');
  });

  it('records a skipped delivery when rights exclude a channel', async () => {
    const restrictedEvent = createArticlePublishedEvent({
      ...event,
      eventId: 'evt-restricted',
      policy: {
        ...event.policy,
        permittedChannels: [],
      },
    });
    const deliveries = await dispatchArticlePublished({
      event: restrictedEvent,
      article: { title: 'Title', text: 'Body' },
      accountIds: { linkedin: 'edlove-main' },
      ledger: createMemoryDispatchLedger(),
      now: restrictedEvent.occurredAt,
    });
    expect(deliveries[0]?.status).toBe('skipped');
  });

  test.for([
    { from: 'submitted', to: 'approved', allowed: false },
    { from: 'in_review', to: 'rights_review', allowed: true },
    { from: 'rights_review', to: 'approved', allowed: true },
    { from: 'approved', to: 'in_review', allowed: false },
  ])(
    'submission lifecycle: from $from -> to $to is allowed=$allowed (T17 test.for capability)',
    ({ from, to, allowed }) => {
      expect(canTransitionSubmission(from as any, to as any)).toBe(allowed);
    },
  );

  it('publishes a LinkedIn post through the supported Posts API shape', async () => {
    let request: Request | undefined;
    const adapter = createLinkedInAdapter({
      accessToken: 'token',
      authorUrn: 'urn:li:organization:1',
      apiVersion: '202601',
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:2' } });
      },
    });
    const result = await adapter.publish(
      createDelivery(event, 'linkedin', 'edlove-main', event.occurredAt),
      adapter.prepare(event, { title: 'Title', text: 'Body' }),
    );
    expect(result).toEqual({
      status: 'published',
      externalUrl: 'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A2',
    });
    expect(request?.headers.get('Linkedin-Version')).toBe('202601');
    expect(await request?.json()).toMatchObject({
      author: 'urn:li:organization:1',
      lifecycleState: 'PUBLISHED',
    });
  });
});

describe('Headless Schemas & Multi-Format Parsing', { tags: ['headless', 'pure', 'fast'] }, () => {
  it('validates canonical article frontmatter with Zod', () => {
    const valid = articleFrontmatterSchema.parse({
      title: 'Headless Publishing',
      workId: 'headless-publishing',
      publishDate: '2026-09-17',
    });
    expect(valid.title).toBe('Headless Publishing');
    expect(valid.language).toBe('en');
    expect(valid.draft).toBe(false);
    expect(valid.distribution.channels).toContain('rss');
  });

  it('parses Markdown frontmatter into typed document', () => {
    const raw = `---
title: "Markdown Piece"
workId: "md-piece"
publishDate: 2026-09-17
language: en
topics: [learning, architecture]
---
# Content Body`;
    const doc = parseEditorialDocument(raw);
    expect(doc.format).toBe('markdown');
    expect(doc.frontmatter.title).toBe('Markdown Piece');
    expect(doc.body).toBe('# Content Body');
  });

  it('parses JSON formatted article bundles', () => {
    const json = JSON.stringify({
      title: 'JSON Article',
      workId: 'json-article',
      publishDate: '2026-09-17',
      body: 'Body from JSON',
    });
    const doc = parseEditorialDocument(json, 'json');
    expect(doc.format).toBe('json');
    expect(doc.frontmatter.title).toBe('JSON Article');
    expect(doc.body).toBe('Body from JSON');
  });

  it('parses Plain Text (.txt) fallback documents gracefully', () => {
    const txt = `My Plain Text Article\nHere is the first paragraph.\nHere is the second.`;
    const doc = parseEditorialDocument(txt, 'text');
    expect(doc.format).toBe('text');
    expect(doc.frontmatter.title).toBe('My Plain Text Article');
    expect(doc.frontmatter.workId).toBe('my-plain-text-article');
    expect(doc.body).toContain('Here is the first paragraph.');
  });

  it('runs headless distribution controller with UTMs and channel switching', async () => {
    const controller = new DistributionController({
      article: {
        title: 'Modular Systems',
        summary: 'Decoupling frontends from editorial contracts.',
        url: 'https://example.com/journal/modular-systems',
        topics: ['architecture', 'design'],
      },
    });

    const state = controller.getState();
    expect(state.activeChannel).toBe('linkedin');
    expect(state.postText).toContain('utm_source=linkedin');
    expect(state.canDispatch).toBe(false);

    controller.setReviewed(true);
    expect(controller.getState().canDispatch).toBe(true);

    controller.setChannel('postiz');
    expect(controller.getState().activeChannel).toBe('postiz');
    expect(controller.getState().postText).toContain('utm_source=postiz');

    controller.setChannel('meta');
    expect(controller.getState().maxChars).toBe(280);
  });

  it('scaffolds article in multiple formats (.md, .txt, .json)', () => {
    const md = scaffoldArticleDocument({ title: 'The Gift Economy', format: 'markdown' });
    expect(md.filename).toBe('the-gift-economy.md');
    expect(md.content).toContain('workId: "the-gift-economy"');

    const txt = scaffoldArticleDocument({ title: 'Field Notes', format: 'text' });
    expect(txt.filename).toBe('field-notes.txt');
    expect(txt.content).toContain('WorkId: field-notes');

    const jsonDoc = scaffoldArticleDocument({ title: 'Curated API Work', format: 'json' });
    expect(jsonDoc.filename).toBe('curated-api-work.json');
    const parsed = JSON.parse(jsonDoc.content);
    expect(parsed.workId).toBe('curated-api-work');
  });

  it('resolves source files across multi-framework candidates', () => {
    const resolved = resolvePageSourceFile('journal/example');
    expect(resolved).toBeDefined();
  });
});

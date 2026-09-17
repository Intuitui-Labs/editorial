import { describe, expect, it, vi } from 'vitest';
import {
  createLinkedInAdapter,
  createMemoryDispatchLedger,
  createPostizAdapter,
  dispatchArticlePublished,
} from './distribution.js';
import {
  createArticlePublishedEvent,
  createDelivery,
  MemoryDistributionLedger,
  transitionDelivery,
} from './domain.js';
import {
  articleFrontmatterSchema,
  parseEditorialDocument,
  defaultArticleValidator,
} from './schema.js';
import { DistributionController } from './distribution-controller.js';
import { createProvenanceSlots } from './provenance.js';

describe('G1 Boundary: Harsh Network & Error Failure Paths', { tags: ['boundary', 'pure', 'fast'] }, () => {
  const baseEvent = createArticlePublishedEvent({
    eventId: 'evt-boundary-1',
    occurredAt: '2026-09-17T00:00:00.000Z',
    workId: 'work-boundary-1',
    versionId: 'version-1',
    publication: 'edlove',
    language: 'en',
    canonicalUrl: 'https://edlove.org/journal/boundary',
    policy: { channels: ['linkedin', 'postiz'], excerptOnly: ['linkedin'], utmCampaign: 'stress-test' },
  });

  it('handles HTTP 429 Rate Limit with Retry-After and marks delivery failed with attempts', async () => {
    const mockFetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
    );

    const postiz = createPostizAdapter({
      baseUrl: 'https://api.postiz.fake',
      apiKey: 'test-key',
      fetcher: mockFetcher as any,
    });

    const ledger = new MemoryDistributionLedger();
    const delivery = createDelivery(baseEvent, 'postiz', 'postiz-main', baseEvent.occurredAt);

    await expect(
      postiz.publish(delivery, {
        title: 'Title',
        text: 'Body',
        url: baseEvent.canonicalUrl,
        publication: 'edlove',
        language: 'en',
        excerptOnly: false,
        utmCampaign: 'stress-test',
      })
    ).rejects.toThrow(/Postiz publish failed with HTTP 429/);
  });

  it('handles HTTP 401 Unauthorized cleanly without crashing the runtime', async () => {
    const mockFetcher = vi.fn().mockResolvedValue(
      new Response('Unauthorized: Invalid Bearer Token', { status: 401 })
    );

    const linkedin = createLinkedInAdapter({
      accessToken: 'expired-token',
      authorUrn: 'urn:li:person:bad',
      apiVersion: '202601',
      fetcher: mockFetcher as any,
    });

    const delivery = createDelivery(baseEvent, 'linkedin', 'li-main', baseEvent.occurredAt);

    await expect(
      linkedin.publish(delivery, {
        title: 'Title',
        text: 'Body',
        url: baseEvent.canonicalUrl,
        publication: 'edlove',
        language: 'en',
        excerptOnly: true,
        utmCampaign: 'stress-test',
      })
    ).rejects.toThrow(/LinkedIn publish failed with HTTP 401/);
  });

  it('survives simulated network crash / fetch abort error', async () => {
    const mockFetcher = vi.fn().mockRejectedValue(new Error('ECONNRESET: Socket hang up'));

    const postiz = createPostizAdapter({
      baseUrl: 'https://api.postiz.fake',
      apiKey: 'test-key',
      fetcher: mockFetcher as any,
    });

    const delivery = createDelivery(baseEvent, 'postiz', 'postiz-main', baseEvent.occurredAt);

    await expect(
      postiz.publish(delivery, {
        title: 'Title',
        text: 'Body',
        url: baseEvent.canonicalUrl,
        publication: 'edlove',
        language: 'en',
        excerptOnly: false,
        utmCampaign: 'stress-test',
      })
    ).rejects.toThrow(/ECONNRESET/);
  });
});

describe('G1 Boundary: Harsh Payload, Multilingual & Unicode Fuzzing', { tags: ['boundary', 'pure', 'fast'] }, () => {
  it('handles multilingual Tamil, Sinhala, and Emoji characters without corruption', () => {
    const sinhalaText = 'ගුරුදෙවි ප්‍රකාශන පද්ධතිය 🇱🇰 ❤️';
    const tamilText = 'குருதேவி பதிப்பக முறைமை 📚';

    const docSinhala = parseEditorialDocument(`---\ntitle: "${sinhalaText}"\nworkId: "si-test"\npublishDate: 2026-09-17\n---\n${sinhalaText}`);
    expect(docSinhala.frontmatter.title).toBe(sinhalaText);
    expect(docSinhala.body).toBe(sinhalaText);

    const docTamil = parseEditorialDocument(`---\ntitle: "${tamilText}"\nworkId: "ta-test"\npublishDate: 2026-09-17\n---\n${tamilText}`);
    expect(docTamil.frontmatter.title).toBe(tamilText);
  });

  it('safely parses malformed and unclosed frontmatter blocks', () => {
    // Unclosed frontmatter (missing ending ---)
    const brokenYaml = `---
title: Unclosed Piece
workId: broken-1
No closing dashes here
Just body text directly`;

    const doc = parseEditorialDocument(brokenYaml);
    expect(doc.format).toBe('text');
    expect(doc.frontmatter.title).toBe('---');
  });

  it('safely rejects invalid Zod article frontmatter with missing mandatory fields', () => {
    expect(() => {
      articleFrontmatterSchema.parse({
        subtitle: 'Missing title and workId',
      });
    }).toThrow();
  });

  it('enforces exact character boundary truncation for Meta/X (280 max chars)', () => {
    const controller = new DistributionController({
      article: {
        title: 'Heading',
        summary: 'x'.repeat(400),
        url: 'https://example.com/long-url',
      },
    });

    controller.setChannel('meta');
    const metaTemplate = controller.buildTemplate('meta');
    expect(metaTemplate).toContain('...');
    expect(controller.getState().maxChars).toBe(280);
  });
});

describe('G1 Boundary: Security & Review Gate Enforcement', { tags: ['boundary', 'pure', 'fast'] }, () => {
  it('strictly rejects dispatch when reviewer gate is unapproved', async () => {
    const controller = new DistributionController({
      article: {
        title: 'Unreviewed draft',
        url: 'https://example.com/draft',
      },
    });

    expect(controller.getState().canDispatch).toBe(false);
    await expect(controller.dispatch()).rejects.toThrow(/reviewer gate not approved/);
  });

  it('prevents channel permission leaks when rights restrict distribution', async () => {
    const event = createArticlePublishedEvent({
      eventId: 'evt-restricted-1',
      occurredAt: '2026-09-17T00:00:00.000Z',
      workId: 'work-restricted-1',
      versionId: 'version-1',
      publication: 'edlove',
      language: 'en',
      canonicalUrl: 'https://edlove.org/journal/restricted',
      policy: {
        channels: ['linkedin', 'postiz'],
        permittedChannels: ['postiz'], // LinkedIn explicitly omitted!
        utmCampaign: 'leak-test',
      },
    });

    const ledger = createMemoryDispatchLedger();
    const deliveries = await dispatchArticlePublished({
      event,
      article: { title: 'Title', text: 'Text' },
      accountIds: { linkedin: 'acct-li', postiz: 'acct-postiz' },
      ledger,
      now: event.occurredAt,
    });

    const linkedinDelivery = deliveries.find(d => d.channel === 'linkedin');
    expect(linkedinDelivery?.status).toBe('skipped');
  });
});

describe('G1 Boundary: Headless Provenance Presenter & Arbitrary Field Mapping', { tags: ['boundary', 'pure', 'fast'] }, () => {
  it('maps custom field names and formats dates into presentation slots', () => {
    const legacyCmsArticle = {
      headline: 'Reclaiming Teacher Dignity',
      byline: 'Naveen Kumara',
      type: 'curated',
      created_at: '2026-08-15T10:00:00.000Z',
      modified_at: '2026-09-01T14:30:00.000Z',
      copyright: 'CC BY 4.0',
      source_link: 'https://gurudevi.org/legacy-article',
      read_duration: 5,
    };

    const slots = createProvenanceSlots(
      legacyCmsArticle,
      {
        title: 'headline',
        author: 'byline',
        contentKind: 'type',
        publishDate: 'created_at',
        updatedDate: 'modified_at',
        license: 'copyright',
        canonicalUrl: 'source_link',
        readingTime: 'read_duration',
      },
      {
        dateFormat: 'iso',
      }
    );

    expect(slots.title).toBe('Reclaiming Teacher Dignity');
    expect(slots.authorBadge.value).toBe('Naveen Kumara');
    expect(slots.kindBadge.value).toBe('Curated Resource');
    expect(slots.publishedText).toBe('2026-08-15');
    expect(slots.modifiedText).toBe('2026-09-01');
    expect(slots.isModified).toBe(true);
    expect(slots.licenseBadge.value).toBe('CC BY 4.0');
    expect(slots.canonicalBadge?.host).toBe('gurudevi.org');
    expect(slots.readingTimeText).toBe('5 min read');
    expect(slots.schemaJsonLd['@type']).toBe('Article');
  });

  it('handles relative date formatting and missing optional fields gracefully', () => {
    const minimalDoc = {
      title: 'Quick Update',
      publishDate: new Date(),
    };

    const slots = createProvenanceSlots(minimalDoc, {}, { dateFormat: 'relative' });
    expect(slots.title).toBe('Quick Update');
    expect(slots.authorBadge.value).toBe('Editorial Desk'); // fallback
    expect(slots.licenseBadge.value).toBe('CC BY-SA 4.0'); // fallback
    expect(slots.publishedText).toBe('today');
    expect(slots.isModified).toBe(false);
  });
});

describe('G1: Swappable Schema & Custom Validator Protocol', () => {
  it('allows replacing Zod with zero-dependency defaultArticleValidator', () => {
    const rawYaml = `---
title: "Zero Dep Article"
publishDate: 2026-09-17
---
Zero dep content`;

    const doc = parseEditorialDocument(rawYaml, {
      validator: defaultArticleValidator,
    });

    expect(doc.frontmatter.title).toBe('Zero Dep Article');
    expect(doc.frontmatter.workId).toBe('zero-dep-article');
    expect(doc.frontmatter.status).toBe('draft');
  });

  it('allows custom function validator with custom shape', () => {
    interface SimpleArticle {
      headline: string;
      customTag: string;
    }

    const customValidator = (raw: any): SimpleArticle => {
      if (!raw.headline) throw new Error('headline required');
      return {
        headline: String(raw.headline),
        customTag: raw.tag || 'general',
      };
    };

    const doc = parseEditorialDocument<SimpleArticle>(
      `---
headline: "Custom Shaped Metadata"
tag: "tech"
---
Content with custom schema`,
      { validator: customValidator }
    );

    expect(doc.frontmatter.headline).toBe('Custom Shaped Metadata');
    expect(doc.frontmatter.customTag).toBe('tech');
  });

  it('swaps in Standard Schema (~standard) compliant object', () => {
    const mockStandardSchema = {
      '~standard': {
        version: 1,
        vendor: 'mock-valibot',
        validate(value: any) {
          if (!value.title) {
            return { issues: [{ message: 'Title is missing in Standard Schema' }] };
          }
          return { value: { ...value, workId: value.workId || 'standard-work' } };
        },
      },
    };

    const doc = parseEditorialDocument(
      `---
title: "Standard Schema Article"
publishDate: 2026-09-17
---
Body`,
      { validator: mockStandardSchema as any }
    );

    expect(doc.frontmatter.title).toBe('Standard Schema Article');
    expect(doc.frontmatter.workId).toBe('standard-work');
  });

  it('reports all aggregated validation errors when validation fails', () => {
    const invalidYaml = `---
publishDate: 2026-09-17
---
Missing title and workId`;
    expect(() => {
      parseEditorialDocument(invalidYaml);
    }).toThrow(/validation failed/i);
  });
});

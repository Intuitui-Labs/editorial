import { z } from 'zod';
import type {
  ContentKind,
  DistributionChannel,
  EditorialStatus,
  Language,
  Publication,
  SubmissionStatus,
  TranslationStatus,
} from './domain.js';

export const publicationSchema = z.enum([
  'edlove',
  'gurudevi',
  'neevsk',
  'intuitui',
]);

export const languageSchema = z.enum(['en', 'si', 'ta']);

export const contentKindSchema = z.enum([
  'original',
  'curated',
  'licensed',
  'guest',
  'translation',
]);

export const editorialStatusSchema = z.enum([
  'draft',
  'submitted',
  'in_review',
  'rights_review',
  'approved',
  'scheduled',
  'published',
  'withdrawn',
]);

export const submissionStatusSchema = z.enum([
  'submitted',
  'in_review',
  'rights_review',
  'approved',
  'rejected',
  'withdrawn',
]);

export const translationStatusSchema = z.enum([
  'not_applicable',
  'draft',
  'in_review',
  'approved',
]);

export const distributionChannelSchema = z.enum([
  'linkedin',
  'medium',
  'substack',
  'meta',
  'postiz',
  'rss',
]);

export const distributionPolicySchema = z.object({
  channels: z.array(distributionChannelSchema).default(['rss']),
  excerptOnly: z.array(distributionChannelSchema).default([]),
  utmCampaign: z.string().default('editorial'),
  permittedChannels: z.array(distributionChannelSchema).optional(),
});

export const articleFrontmatterSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  subtitle: z.string().optional(),
  workId: z.string().min(1, 'Work ID is required'),
  contentKind: contentKindSchema.default('original'),
  authorId: z.string().optional(),
  author: z.string().default('Editorial Desk'),
  scribe: z.string().optional(),
  scribeNote: z.string().optional(),
  language: languageSchema.default('en'),
  topics: z.array(z.string()).default([]),
  publishDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  readingTime: z.number().optional(),
  heroImage: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  license: z.string().default('CC BY-SA 4.0'),
  source: z.string().url().optional(),
  rightsAgreementId: z.string().optional(),
  translationOf: z.string().optional(),
  translationStatus: translationStatusSchema.default('not_applicable'),
  distribution: distributionPolicySchema.default({
    channels: ['rss'],
    excerptOnly: [],
    utmCampaign: 'editorial',
  }),
  draft: z.boolean().default(false),
});

export const authorFrontmatterSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  biography: z.string().default(''),
  email: z.string().email().optional(),
  websiteUrl: z.string().url().optional(),
  socialLinks: z.record(z.string(), z.string()).default({}),
  attributionName: z.string().optional(),
  draft: z.boolean().default(false),
});

export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>;
export type AuthorFrontmatter = z.infer<typeof authorFrontmatterSchema>;
export type DistributionPolicyConfig = z.infer<typeof distributionPolicySchema>;

export type SupportedContentFormat = 'markdown' | 'mdx' | 'text' | 'json' | 'html';

export interface ParsedEditorialDocument {
  frontmatter: ArticleFrontmatter;
  body: string;
  format: SupportedContentFormat;
}

/**
 * Headless multi-format document parser.
 * Supports Markdown/MDX frontmatter, JSON bundles, and structured Plain Text (.txt).
 */
export function parseEditorialDocument(
  rawContent: string,
  hintFormat?: SupportedContentFormat
): ParsedEditorialDocument {
  const trimmed = rawContent.trim();

  // 1. JSON format detection
  if (hintFormat === 'json' || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      const { body = '', content = '', text = '', ...meta } = parsed;
      const frontmatter = articleFrontmatterSchema.parse(meta);
      return {
        frontmatter,
        body: body || content || text,
        format: 'json',
      };
    } catch {
      // If JSON parse fails, fallback
    }
  }

  // 2. YAML frontmatter in Markdown, MDX, or HTML
  if (trimmed.startsWith('---')) {
    const secondDelim = trimmed.indexOf('---', 3);
    if (secondDelim !== -1) {
      const yamlBlock = trimmed.slice(3, secondDelim).trim();
      const body = trimmed.slice(secondDelim + 3).trim();
      
      const meta: Record<string, any> = {};
      for (const line of yamlBlock.split(/\r?\n/)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();

        if (val.startsWith('[') && val.endsWith(']')) {
          meta[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        } else if (val === 'true') {
          meta[key] = true;
        } else if (val === 'false') {
          meta[key] = false;
        } else if (!isNaN(Number(val)) && val !== '') {
          meta[key] = Number(val);
        } else {
          meta[key] = val.replace(/^['"]|['"]$/g, '');
        }
      }

      const frontmatter = articleFrontmatterSchema.parse(meta);
      const format = hintFormat || 'markdown';
      return { frontmatter, body, format };
    }
  }

  // 3. Plain Text (.txt) / Raw Body fallback
  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0]?.trim() || 'Untitled Document';
  const body = lines.slice(1).join('\n').trim() || firstLine;
  const slug = firstLine.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

  const defaultMeta = {
    title: firstLine,
    workId: slug,
    publishDate: new Date(),
    draft: true,
  };

  return {
    frontmatter: articleFrontmatterSchema.parse(defaultMeta),
    body,
    format: 'text',
  };
}

/**
 * @intuitui-labs/editorial - Headless Provenance Presenter & Metadata Mapper
 * 
 * Provides an agnostic, slot-based presentation model for editorial provenance,
 * author attribution, licensing, and timestamps.
 * 
 * Consumers can map arbitrary metadata field names, customize date formats,
 * and render with any design system or frontend framework (React, Svelte, Vue, Astro, HTML).
 */

export interface ProvenanceFieldMapping {
  title?: string;
  subtitle?: string;
  contentKind?: string;
  author?: string;
  authorUrl?: string;
  publishDate?: string;
  updatedDate?: string;
  license?: string;
  canonicalUrl?: string;
  originPublication?: string;
  topics?: string;
  readingTime?: string;
}

export interface ProvenanceFormattingOptions {
  locale?: string;
  dateFormat?: 'iso' | 'localized' | 'relative' | ((date: Date) => string);
  fallbackAuthor?: string;
  fallbackLicense?: string;
  kindLabels?: Record<string, string>;
}

export interface ProvenanceBadge {
  label: string;
  value: string;
  url?: string;
}

export interface ProvenanceRenderSlots {
  title: string;
  subtitle?: string;
  authorBadge: ProvenanceBadge;
  publishedText: string;
  modifiedText?: string;
  isModified: boolean;
  kindBadge: ProvenanceBadge;
  licenseBadge: ProvenanceBadge;
  canonicalBadge?: { url: string; host: string };
  readingTimeText?: string;
  provenanceSummary: string;
  schemaJsonLd: Record<string, any>;
}

const defaultFieldMapping: Required<ProvenanceFieldMapping> = {
  title: 'title',
  subtitle: 'subtitle',
  contentKind: 'contentKind',
  author: 'author',
  authorUrl: 'authorUrl',
  publishDate: 'publishDate',
  updatedDate: 'updatedDate',
  license: 'license',
  canonicalUrl: 'canonicalUrl',
  originPublication: 'originPublication',
  topics: 'topics',
  readingTime: 'readingTime',
};

const defaultKindLabels: Record<string, string> = {
  original: 'Original Work',
  curated: 'Curated Resource',
  licensed: 'Licensed Republication',
  guest: 'Guest Contribution',
  translation: 'Reviewed Translation',
};

/**
 * Normalizes and formats arbitrary metadata into strongly-typed presentation slots.
 */
export function createProvenanceSlots(
  rawMetadata: Record<string, any>,
  mapping: ProvenanceFieldMapping = {},
  options: ProvenanceFormattingOptions = {}
): ProvenanceRenderSlots {
  const map = { ...defaultFieldMapping, ...mapping };
  const locale = options.locale ?? 'en-US';

  const title = String(rawMetadata[map.title] ?? rawMetadata.name ?? 'Untitled Piece');
  const subtitle = rawMetadata[map.subtitle] ? String(rawMetadata[map.subtitle]) : undefined;
  const rawKind = String(rawMetadata[map.contentKind] ?? rawMetadata.type ?? rawMetadata.category ?? 'original');
  const kindLabels = { ...defaultKindLabels, ...options.kindLabels };
  const kindLabel = kindLabels[rawKind] ?? rawKind;

  const authorName = String(
    rawMetadata[map.author] ??
    rawMetadata.byline ??
    rawMetadata.authorName ??
    options.fallbackAuthor ??
    'Editorial Desk'
  );
  const authorUrl = rawMetadata[map.authorUrl] ?? (rawMetadata.author && typeof rawMetadata.author === 'object' ? rawMetadata.author.url : undefined);

  // Date normalization:
  const rawPubDate = rawMetadata[map.publishDate] ?? rawMetadata.datePublished ?? rawMetadata.created_at ?? rawMetadata.date;
  const pubDate = rawPubDate ? new Date(rawPubDate) : new Date();
  const rawModDate = rawMetadata[map.updatedDate] ?? rawMetadata.dateModified ?? rawMetadata.updated_at;
  const modDate = rawModDate ? new Date(rawModDate) : undefined;

  const formatDate = (d: Date): string => {
    if (typeof options.dateFormat === 'function') {
      return options.dateFormat(d);
    }
    if (options.dateFormat === 'iso') {
      return d.toISOString().split('T')[0] ?? '';
    }
    if (options.dateFormat === 'relative') {
      const diffDays = Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'today';
      if (diffDays === 1) return 'yesterday';
      return `${diffDays} days ago`;
    }
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const publishedText = isNaN(pubDate.getTime()) ? String(rawPubDate) : formatDate(pubDate);
  const isModified = Boolean(modDate && !isNaN(modDate.getTime()) && modDate.getTime() > pubDate.getTime());
  const modifiedText = isModified && modDate ? formatDate(modDate) : undefined;

  const licenseName = String(
    rawMetadata[map.license] ??
    rawMetadata.copyright ??
    options.fallbackLicense ??
    'CC BY-SA 4.0'
  );

  const canonicalUrl = rawMetadata[map.canonicalUrl] ? String(rawMetadata[map.canonicalUrl]) : undefined;
  let canonicalBadge: { url: string; host: string } | undefined;
  if (canonicalUrl) {
    try {
      const parsed = new URL(canonicalUrl);
      canonicalBadge = { url: canonicalUrl, host: parsed.hostname };
    } catch {
      canonicalBadge = { url: canonicalUrl, host: canonicalUrl };
    }
  }

  const rawReadingTime = rawMetadata[map.readingTime];
  const readingTimeText = rawReadingTime ? `${rawReadingTime} min read` : undefined;

  const provenanceSummary = isModified
    ? `Published on ${publishedText} • Updated ${modifiedText}`
    : `Published on ${publishedText}`;

  const schemaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: subtitle,
    datePublished: isNaN(pubDate.getTime()) ? undefined : pubDate.toISOString(),
    dateModified: modDate && !isNaN(modDate.getTime()) ? modDate.toISOString() : (isNaN(pubDate.getTime()) ? undefined : pubDate.toISOString()),
    author: {
      '@type': 'Person',
      name: authorName,
      url: authorUrl,
    },
    license: licenseName,
    mainEntityOfPage: canonicalUrl,
  };

  return {
    title,
    subtitle,
    authorBadge: { label: 'Author', value: authorName, url: authorUrl },
    publishedText,
    modifiedText,
    isModified,
    kindBadge: { label: 'Type', value: kindLabel },
    licenseBadge: { label: 'License', value: licenseName },
    canonicalBadge,
    readingTimeText,
    provenanceSummary,
    schemaJsonLd,
  };
}

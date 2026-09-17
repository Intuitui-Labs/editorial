#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import type { SupportedContentFormat } from './schema.js';

export interface ScaffoldOptions {
  publication?: 'edlove' | 'gurudevi' | 'neevsk' | 'intuitui';
  title: string;
  slug?: string;
  author?: string;
  authorId?: string;
  language?: 'en' | 'si' | 'ta';
  topics?: string[];
  contentKind?: 'original' | 'curated' | 'licensed' | 'guest' | 'translation';
  format?: SupportedContentFormat;
  outDir?: string;
}

export function scaffoldArticleDocument(options: ScaffoldOptions): { filename: string; content: string } {
  const slug = options.slug || options.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const author = options.author || 'Editorial Desk';
  const authorId = options.authorId || author.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const pub = options.publication || 'edlove';
  const lang = options.language || 'en';
  const topics = options.topics && options.topics.length > 0 ? options.topics : ['education', 'publishing'];
  const kind = options.contentKind || 'original';
  const format = options.format || 'markdown';
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const jsonPayload = {
      title: options.title,
      subtitle: 'Enter summary here.',
      workId: slug,
      contentKind: kind,
      authorId,
      author,
      language: lang,
      topics,
      publishDate: dateStr,
      readingTime: 4,
      license: 'CC BY-SA 4.0',
      draft: true,
      distribution: {
        channels: ['rss', 'linkedin', 'postiz'],
        excerptOnly: ['linkedin', 'meta'],
        utmCampaign: `${slug}-launch`,
      },
      body: `# ${options.title}\n\nWrite article content here...`,
    };
    return {
      filename: `${slug}.json`,
      content: JSON.stringify(jsonPayload, null, 2) + '\n',
    };
  }

  if (format === 'text') {
    const textContent = [
      options.title,
      `WorkId: ${slug}`,
      `Author: ${author}`,
      `Language: ${lang}`,
      `Date: ${dateStr}`,
      '---',
      `Summary: Enter summary here.`,
      '',
      'Write plain text article content here...',
      '',
    ].join('\n');
    return {
      filename: `${slug}.txt`,
      content: textContent,
    };
  }

  const ext = format === 'mdx' ? 'mdx' : 'md';
  const frontmatter = [
    '---',
    `title: "${options.title}"`,
    `subtitle: "Enter summary here."`,
    `workId: "${slug}"`,
    `contentKind: "${kind}"`,
    `authorId: "${authorId}"`,
    `author: "${author}"`,
    `language: "${lang}"`,
    `topics: [${topics.join(', ')}]`,
    `publishDate: ${dateStr}`,
    `readingTime: 4`,
    `license: "CC BY-SA 4.0"`,
    `draft: true`,
    'distribution:',
    '  channels: [rss, linkedin, postiz]',
    '  excerptOnly: [linkedin, meta]',
    `  utmCampaign: "${slug}-launch"`,
    '---',
    '',
    `# ${options.title}`,
    '',
    'Write article content here...',
    '',
  ].join('\n');

  return {
    filename: `${slug}.${ext}`,
    content: frontmatter,
  };
}

if (process.argv[1]?.endsWith('cli.js') || process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('editorial')) {
  const args = process.argv.slice(2);
  const titleIndex = args.indexOf('--title');
  const title = titleIndex !== -1 ? args[titleIndex + 1] : args[0];

  if (!title || title.startsWith('--')) {
    console.log('Usage: npx @intuitui-labs/editorial new --title "Article Title" [--format md|mdx|txt|json] [--slug slug] [--pub edlove|gurudevi] [--lang en|si|ta] [--out path]');
    process.exit(1);
  }

  const slugIndex = args.indexOf('--slug');
  const pubIndex = args.indexOf('--pub');
  const langIndex = args.indexOf('--lang');
  const formatIndex = args.indexOf('--format');
  const outIndex = args.indexOf('--out');

  const slug = slugIndex !== -1 ? args[slugIndex + 1] : undefined;
  const publication = (pubIndex !== -1 ? args[pubIndex + 1] : 'edlove') as any;
  const language = (langIndex !== -1 ? args[langIndex + 1] : 'en') as any;
  const format = (formatIndex !== -1 ? args[formatIndex + 1] : 'markdown') as any;
  const targetDir = outIndex !== -1 ? args[outIndex + 1] : process.cwd();

  const { filename, content } = scaffoldArticleDocument({
    title,
    slug,
    publication,
    language,
    format,
  });

  const fullPath = path.join(targetDir, filename);
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Successfully scaffolded editorial document: ${fullPath}`);
}

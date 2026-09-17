/**
 * @intuitui-labs/editorial - Page Metadata & Git Provenance Engine
 *
 * Extracts first-commit (published) and latest-commit (modified) timestamps directly from
 * git history for every page, generating Schema.org JSON-LD and editorial contracts.
 *
 * Supports Astro, Next.js (App & Pages), SvelteKit, Nuxt, Remix, and static Markdown/Text.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
const gitCache = new Map();
export function resolvePageSourceFile(routeOrPath, options = process.cwd()) {
    const rootDir = typeof options === 'string' ? options : (options.rootDir ?? process.cwd());
    const custom = typeof options === 'object' && options.customCandidates ? options.customCandidates : [];
    if (fs.existsSync(`${rootDir}/${routeOrPath}`)) {
        return routeOrPath;
    }
    for (const candidate of custom) {
        if (fs.existsSync(`${rootDir}/${candidate}`)) {
            return candidate;
        }
    }
    const clean = routeOrPath.replace(/^\/|\/$/g, '');
    if (!clean) {
        const indexCandidates = [
            'src/pages/index.astro',
            'app/page.tsx',
            'app/page.jsx',
            'src/app/page.tsx',
            'src/app/page.jsx',
            'pages/index.tsx',
            'pages/index.jsx',
            'src/pages/index.tsx',
            'src/routes/+page.svelte',
            'pages/index.vue',
            'index.html',
        ];
        for (const c of indexCandidates) {
            if (fs.existsSync(`${rootDir}/${c}`))
                return c;
        }
        return 'src/pages/index.astro';
    }
    const segments = clean.split('/');
    const baseSegment = segments[0] || '';
    const extensions = ['.md', '.mdx', '.txt', '.json', '.html', '.astro', '.tsx', '.jsx', '.svelte', '.vue'];
    const candidates = [];
    const searchDirs = [
        'src/content/journal',
        'src/content',
        'content/journal',
        'content',
        'src/pages',
        'pages',
        'app',
        'src/app',
        'src/routes',
    ];
    for (const dir of searchDirs) {
        for (const ext of extensions) {
            candidates.push(`${dir}/${clean}${ext}`);
            candidates.push(`${dir}/${clean}/index${ext}`);
            if (baseSegment) {
                candidates.push(`${dir}/${baseSegment}/[slug]${ext}`);
                candidates.push(`${dir}/${baseSegment}/[...slug]${ext}`);
            }
        }
    }
    for (const ext of extensions) {
        candidates.push(`${clean}${ext}`);
    }
    for (const candidate of candidates) {
        if (fs.existsSync(`${rootDir}/${candidate}`)) {
            return candidate;
        }
    }
    return 'src/pages/index.astro';
}
export function getGitDates(filePathOrRoute, optionsOrCwd = process.cwd()) {
    const cwd = typeof optionsOrCwd === 'string' ? optionsOrCwd : (optionsOrCwd.rootDir ?? process.cwd());
    const resolvedPath = resolvePageSourceFile(filePathOrRoute, optionsOrCwd);
    const cacheKey = `${cwd}:${resolvedPath}`;
    if (gitCache.has(cacheKey)) {
        return gitCache.get(cacheKey);
    }
    if (process.env.NODE_ENV === 'development') {
        const now = new Date().toISOString();
        const devDates = { published: now, modified: now };
        gitCache.set(cacheKey, devDates);
        return devDates;
    }
    let published = '';
    let modified = '';
    try {
        const fullPath = `${cwd}/${resolvedPath}`;
        if (fs.existsSync(fullPath)) {
            const modResult = execSync(`git log -1 --format=%aI -- "${resolvedPath}"`, {
                cwd,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            if (modResult)
                modified = modResult;
            const pubResult = execSync(`git log --follow --format=%aI -- "${resolvedPath}"`, {
                cwd,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            if (pubResult) {
                const lines = pubResult.split(/\r?\n/).filter(Boolean);
                published = lines[lines.length - 1]?.trim() || modified;
            }
        }
    }
    catch {
        // Fallback if git fails
    }
    if (!modified || !published) {
        try {
            const fullPath = `${cwd}/${resolvedPath}`;
            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                const fileDate = stats.mtime.toISOString();
                if (!modified)
                    modified = fileDate;
                if (!published)
                    published = stats.birthtime.toISOString() || fileDate;
            }
        }
        catch {
            // Ignored
        }
    }
    const now = new Date().toISOString();
    const result = {
        published: published || now,
        modified: modified || published || now,
    };
    gitCache.set(cacheKey, result);
    return result;
}
export function generatePageStructuredData(meta) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: meta.title,
        description: meta.description,
        url: meta.canonicalUrl,
        datePublished: meta.datePublished,
        dateModified: meta.dateModified,
        inLanguage: meta.language ?? 'en',
        author: {
            '@type': 'Person',
            name: meta.author,
        },
        publisher: {
            '@type': 'Organization',
            name: meta.originPublication,
            url: meta.canonicalUrl,
        },
        license: meta.license,
        keywords: meta.keywords?.join(', '),
    };
}
//# sourceMappingURL=page-metadata.js.map
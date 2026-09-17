/**
 * @intuitui-labs/editorial - Page Metadata & Git Provenance Engine
 *
 * Extracts first-commit (published) and latest-commit (modified) timestamps directly from
 * git history for every page, generating Schema.org JSON-LD and editorial contracts.
 *
 * Supports Astro, Next.js (App & Pages), SvelteKit, Nuxt, Remix, and static Markdown/Text.
 */
export interface PageEditorialMetadata {
    title: string;
    description: string;
    canonicalUrl: string;
    originPublication: 'neevsk' | 'intuitui' | 'edlove' | 'gurudevi';
    author: string;
    license: string;
    datePublished: string;
    dateModified: string;
    workId?: string;
    language?: string;
    keywords?: string[];
}
export interface ResolvePageSourceOptions {
    rootDir?: string;
    customCandidates?: string[];
    allowedExtensions?: string[];
}
export declare function resolvePageSourceFile(routeOrPath: string, options?: ResolvePageSourceOptions | string): string;
export declare function getGitDates(filePathOrRoute: string, optionsOrCwd?: ResolvePageSourceOptions | string): {
    published: string;
    modified: string;
};
export declare function generatePageStructuredData(meta: PageEditorialMetadata): {
    '@context': string;
    '@type': string;
    name: string;
    description: string;
    url: string;
    datePublished: string;
    dateModified: string;
    inLanguage: string;
    author: {
        '@type': string;
        name: string;
    };
    publisher: {
        '@type': string;
        name: "edlove" | "gurudevi" | "intuitui" | "neevsk";
        url: string;
    };
    license: string;
    keywords: string | undefined;
};
//# sourceMappingURL=page-metadata.d.ts.map
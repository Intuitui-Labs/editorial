# Repository Badges, Metrics & Quality Signals Landscape

This guide defines the complete landscape of repository badges, third-party badge providers, cost analysis, and the top 15 quality indicators utilized by modern open-source TypeScript packages.

---

## 1. Provider Ecosystem & Cost Analysis

| Provider | Core Purpose | Pricing Model for Open Source | Integration Mechanism |
| :--- | :--- | :--- | :--- |
| **Shields.io** | Universal SVG badge gateway (npm, downloads, static, dynamic JSON) | **100% Free** (Community-hosted, open-source) | URL parameters over CDN |
| **GitHub Actions** | Real-time CI workflow execution status | **100% Free** (Native for public GitHub repositories) | `/workflows/<name>/badge.svg` endpoint |
| **Codecov** | Line, branch, and statement test coverage analysis | **100% Free** (Free tier for public open source) | `codecov/codecov-action` in CI |
| **Coveralls** | Continuous coverage history and trend tracking | **100% Free** (Free tier for public open source) | GitHub Actions reporter upload |
| **Bundlephobia** | Bundle size, minified size, gzip size, tree-shaking verification | **100% Free** (Public community engine) | Automated registry scan on publish |
| **Socket.dev** / **Snyk** | Supply-chain security, malware detection, CVE and malicious package audits | **100% Free for Open Source** | GitHub App / PR security bot |

> [!NOTE]
> All services above are completely free for public open-source repositories hosted under GitHub and npm.

---

## 2. Top 15 Repository Badges Landscape

| # | Badge Category | What It Proves to Consumers | Source / Format |
| :-: | :--- | :--- | :--- |
| **1** | **npm Version** | Current latest stable release version | `https://img.shields.io/npm/v/@intuitui-labs/editorial` |
| **2** | **CI Build Status** | Whether current main builds, typechecks, and passes tests | GitHub Actions CI workflow |
| **3** | **Test Coverage** | Exact % of codebase exercised by tests | Codecov / Coveralls via lcov artifact |
| **4** | **License** | Permissive open-source commercial terms (MIT) | `https://img.shields.io/npm/l/@intuitui-labs/editorial` |
| **5** | **Bundle Size (minzip)** | Client impact when bundled in production | `https://img.shields.io/bundlephobia/minzip/@intuitui-labs/editorial` |
| **6** | **Monthly Downloads** | Adoption velocity and active usage | `https://img.shields.io/npm/dm/@intuitui-labs/editorial` |
| **7** | **TypeScript Native** | Zero extra `@types` package needed | `https://img.shields.io/npm/types/@intuitui-labs/editorial` |
| **8** | **Tree Shaking** | Pure ESM modules with `sideEffects: false` | Static verified badge |
| **9** | **Standard Schema** | Ecosystem-wide `~standard` validation compliance | Static contract badge |
| **10** | **Vitest 5 Engine** | Tested on latest modern test runner | Static engine badge |
| **11** | **Node Compatibility** | Supported runtime environments (Node 18+, Edge) | `https://img.shields.io/node/v/@intuitui-labs/editorial` |
| **12** | **OpenSSF / Security** | Automated vulnerability and supply-chain audit | Socket.dev or OpenSSF Scorecard |
| **13** | **Semantic Release** | Predictable SemVer release automation | Standardized release protocol |
| **14** | **GitHub Stars** | Community popularity and engagement | `https://img.shields.io/github/stars/Intuitui-Labs/editorial` |
| **15** | **PRs Welcome** | Community openness to issues and contributions | Static badge |

---

## 3. Implementation Blueprint for `@intuitui-labs/editorial`

1. **GitHub Actions CI Workflow (`.github/workflows/ci.yml`)**:
   - Runs on all pushes and PRs to `main`.
   - Executes `pnpm check-types`, `pnpm test --coverage`, and `pnpm build`.
   - Generates `lcov.info` and uploads coverage artifacts to Codecov.
2. **README Header Integration**:
   - Embeds clean, unified flat-square badges displaying npm version, build status, bundle size, license, Standard Schema compliance, Vitest engine, and types.

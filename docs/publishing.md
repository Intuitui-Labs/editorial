# Publishing Guide for `@intuitui-labs/editorial`

This guide details the release cycle, quality preflight checks, authentication, 2FA/OTP handling, and CI/CD automation for publishing **`@intuitui-labs/editorial`** to the public npm registry.

---

## 1. Prerequisites & Access

To publish packages under the `@intuitui-labs` organization scope:
1. **npm Organization**: You must be an Owner or Maintainer of the [`@intuitui-labs`](https://www.npmjs.com/org/intuitui-labs) organization on npm.
2. **Account 2FA**: npm mandates Two-Factor Authentication (2FA) for write and publish actions on all packages.
3. **npm Login**: Ensure your CLI is authenticated:
   ```bash
   npm whoami
   # Output should display your npm username (e.g., neevsk)
   ```
   If not authenticated, run:
   ```bash
   npm login
   ```

---

## 2. Preflight Quality Verification

Never publish without passing all local quality gates:

```bash
# 1. Strict TypeScript validation (zero emit errors)
pnpm check-types

# 2. Test Suite (G0 contract & G1 boundary tests)
pnpm test

# 3. Clean production bundle generation
pnpm build
```

---

## 3. Versioning Strategy

We follow [Semantic Versioning (SemVer)](https://semver.org/):
- **Patch release** (`0.1.0` → `0.1.1`): Bug fixes, non-breaking type adjustments, documentation.
- **Minor release** (`0.1.1` → `0.2.0`): Backward-compatible new features (e.g., swappable schema support, new adapters).
- **Major release** (`0.2.0` → `1.0.0`): Breaking API changes or deprecations.

To bump the version:
```bash
# Patch
npm version patch --no-git-tag-version

# Minor
npm version minor --no-git-tag-version
```

---

## 4. Manual Publishing via CLI (Local)

Because scoped packages are private by default on npm, you must explicitly pass `--access public`.

### Option A: Interactive TTY (Standard)
In your local terminal:
```bash
npm publish --access public
```
*The npm CLI will prompt you:*
```text
Enter OTP: 123456
```
Type the 6-digit code from your authenticator app and press Enter.

### Option B: Providing OTP via Flag
If running from a script or terminal session:
```bash
npm publish --access public --otp=123456
```
*(Replace `123456` with your active 6-digit TOTP code before it expires).*

---

## 5. Automated CI/CD Publishing (GitHub Actions)

To avoid manual OTP prompts and enable continuous delivery on Git tags or releases:

### Step 1: Create a Granular Access Token on npm
1. Go to **[npmjs.com](https://www.npmjs.com/)** → **Access Tokens** → **Generate New Token** → **Granular Access Token**.
2. **Scope**: Select your organization `@intuitui-labs` or package `@intuitui-labs/editorial`.
3. **Permissions**: Select **Read and write**.
4. **Bypass 2FA for Automation**: If allowed for your organization plan, enable 2FA bypass for automation tokens.

### Step 2: Store in GitHub Repository Secrets
1. In the GitHub repository (`https://github.com/Intuitui-Labs/editorial`), navigate to **Settings** → **Secrets and variables** → **Actions**.
2. Create a new secret named:
   ```text
   NPM_TOKEN
   ```

### Step 3: Example GitHub Actions Workflow (`.github/workflows/publish.yml`)
```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile
      - run: pnpm check-types
      - run: pnpm test
      - run: pnpm build

      - name: Publish package
        run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 6. Verifying Propagation

Once published, verify that the release is immediately available on npm:

```bash
# View published versions and latest tag
npm view @intuitui-labs/editorial version
npm view @intuitui-labs/editorial dist-tags

# Inspect full release metadata
npm view @intuitui-labs/editorial time --json
```

You can also visit the package page directly at:
[https://www.npmjs.com/package/@intuitui-labs/editorial](https://www.npmjs.com/package/@intuitui-labs/editorial)

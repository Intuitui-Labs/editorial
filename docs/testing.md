# Testing Architecture & Test-Claim Protocol Evidence Specification

> **Package:** `@intuitui-labs/editorial`  
> **Test Engine:** Vitest 5.0+ (SPEC-TOOL-008)  
> **Evidence Levels:** G0 Contract/Unit & G1 Boundary/Mock  

---

## 1. Evidence Level Classification

Per the platform's **Test-Claim Protocol**, tests in this package are strictly classified across two tiers:

### Level G0: Contract / Unit
- **Engine**: Vitest 5.0+ running on Node.js 22/24+
- **Scope**: Pure deterministic algorithms, in-memory state, and static TypeScript boundaries.
- **Suite**: `src/domain.test.ts`
- **Command**: `pnpm run test:fast` (Filtered with `--tagsFilter "pure && fast"`)
- **Assertions prove**:
  - `canTransitionSubmission` state transition validity.
  - Idempotent delivery key deduplication.
  - Zod contract parsing across Markdown, MDX, Plain Text, and JSON.
  - Character limit calculations and multi-framework file path scanning.

### Level G1: Boundary / Mock (Harsh Failure Path Verification)
- **Engine**: Vitest 5.0+ running on Node.js 22/24+
- **Scope**: Boundary contracts with substituted network/ports and intentional failure path injection.
- **Suite**: `src/boundary.test.ts`
- **Command**: `pnpm run test:g1` (Filtered with `--tagsFilter "boundary"`)
- **Assertions prove**:
  - **HTTP 429 Rate Limits**: Correct handling of `Retry-After` headers and delivery failure tagging.
  - **HTTP 401/403 Auth Failures**: Immediate halt on expired/invalid Bearer tokens.
  - **Network Crashes**: Resilience to socket hang-ups (`ECONNRESET`) and abort signals.
  - **Unicode & Multilingual Fuzzing**: Flawless preservation of Sinhala, Tamil, and Emoji without multi-byte truncation.
  - **Security Gate Invariants**: Mandatory reviewer sign-off before dispatch execution.
  - **Arbitrary Field Mapping**: Normalization of non-standard schema field names into presentation slots.
- **What is not proven**:
  - Live production third-party servers (actual LinkedIn / Postiz production instances).
  - Real browser DOM rendering or visual layout fidelity.
  - Host OS filesystem permission denials under locked containers.

---

## 2. Advanced Vitest 5 Capabilities Employed

| Capability | Implementation | Benefit |
| :--- | :--- | :--- |
| **T2 `fsModuleCache`** | `test.fsModuleCache: true` in `vitest.config.ts` | Transformed ASTs cached on disk; warm test runs in <50ms. |
| **T8 Test Tags** | `{ tags: ['editorial', 'pure', 'fast', 'headless', 'boundary'] }` | Granular tagged test slicing via `--tagsFilter`. |
| **T16 `expectTypeOf`** | `expectTypeOf<AuthorProfile['displayName']>().toBeString()` | Static TypeScript type testing directly inside test suites. |
| **T17 `test.for`** | `test.for([ ... ])('lifecycle: ...')` | High-density parametric table-driven testing without boilerplate. |
| **V11 `sharedViteServer`** | `test.sharedViteServer: true` in `vitest.config.ts` | Multi-suite shared server daemon reducing RAM overhead. |

---

## 3. Running Test Suites

```bash
# Full test suite (All G0 + G1 tests)
pnpm test

# G0 Pure Contract tests only (<100ms)
pnpm run test:fast

# G1 Harsh Boundary & Failure tests only
pnpm run test:g1

# Interactive TDD watch mode
pnpm run test:watch
```

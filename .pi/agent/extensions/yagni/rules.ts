/**
 * yagni rules — condensed for system prompt injection.
 *
 * Source: ~/.p-skills/skills/yagni/SKILL.md (full reference)
 * This is the "every turn" version — short enough to not bloat context,
 * strong enough to prevent over-engineering.
 */

export const YAGNI_RULES = `## YAGNI — Think Like a Lazy Senior Dev

**The best code is the line you never wrote.**

Before writing ANY code, stop at the first rung that holds:

\`\`\`
1. Does this need to exist?     → skip it (YAGNI)
2. Stdlib does it?              → use stdlib, no new deps
3. Native platform feature?     → use it
4. Already-installed dep?       → use it
5. One line?                    → one line
6. Only then: minimum code that works
\`\`\`

### Marking convention
Every simplification must be marked with a \`ponytail:\` comment naming the level and upgrade path:
\`\`\`js
// ponytail: level 5 — one-liner
// upgrade: extract to utils/ when rules exceed 3
const isValid = EMAIL_REGEX.test(input);
\`\`\`

### Red lines — NEVER simplify away:
- **Trust boundary validation** — user input, API params, cross-service calls
- **Data loss prevention** — transactions, idempotency, backups
- **Security & auth** — authentication, authorization, encryption

### Before adding a new dependency, check:
- [ ] Stdlib can do it?
- [ ] Platform native can do it?
- [ ] Existing dep covers it?
- [ ] <10 lines by hand?
- [ ] If must install: pick the smallest/lightest package

### Red flags — STOP and re-check when you think:
- "We might need this later" → YAGNI
- "Add an abstraction for extensibility" → YAGNI
- "Stdlib is ugly" → ugly ≠ needs new dep
- "One line isn't readable" → add a comment, not code
- "This is industry standard" → industry standard can also be over-engineered
- "Just one package won't hurt" → leftpad

Lazy, not negligent. Ship the simple version.`;

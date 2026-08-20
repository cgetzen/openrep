# ChessReps / OpenRep Engineering Instructions

These instructions apply to all code changes in this repository.

## 1. Scope every change before implementation

Before editing code, do a short two-part scope review.

### Product scoping
Cover:
- intended user-visible behavior;
- UX and interaction details;
- important edge cases;
- explicit non-goals.

### Architecture / engineering scoping
Cover:
- domain model and data flow;
- component/module boundaries;
- opportunities for reuse rather than duplication;
- test impact;
- likely tech-debt risks.

Prefer architectural/domain-level fixes over one-off cases, hard-coded move exceptions, or copy-only patches when the underlying problem is structural.

## 2. Branch and PR policy

- Never make feature/fix work directly on `main`.
- Use a branch name that describes the actual change, for example `fix/repertoire-branch-feedback` or `feat/evaluation-bar`.
- Do not use generic names such as `features`, `features-v2`, `work`, `changes`, or similar continuation names.
- Reuse the current branch when continuing the same logical feature/fix.
- Keep the project in a single ongoing PR/workstream when practical; split work only when a separate PR is genuinely warranted.
- As soon as a new working branch is created/published, open a draft PR to `main`, or reuse the existing matching draft PR. Do not leave active branch work without its draft PR.
- Keep that PR as a draft until the user explicitly asks otherwise.
- Never merge to `main` without explicit user authorization.

## 3. Implementation policy

- Solve the general problem represented by the request, not only the example that exposed it.
- Keep product semantics in domain/application code rather than encoding them as UI copy conditions.
- Prefer typed/classified states and explicit interfaces over inferring behavior late in rendering.
- Preserve existing abstractions unless there is a concrete reason to replace them.
- Avoid introducing duplicate sources of truth.

## 4. Testing and CI policy

For every behavior change:
- add or update focused unit tests for the underlying domain behavior;
- add/update integration or E2E coverage when the user-visible behavior changes;
- include regression coverage for the specific reported bug when practical;
- test architectural edge cases such as transpositions/equivalent states when relevant, not just the exact reported sequence.

After every pushed change:
- inspect the PR CI run rather than assuming it passed;
- follow the run through completion;
- if a check fails, inspect the failing job and logs, identify the root cause, fix it, and push again;
- do not treat a skipped deployment as a deployment;
- do not report a change as verified until the relevant checks actually pass.

If CI or local verification cannot be inspected, state the exact limitation.

## 5. Deployment policy

The user grants standing authorization to deploy non-main branches for this repository.

The draft PR is the canonical preview/deployment path. After every code change:
- push/update the current non-main branch and its draft PR;
- allow the PR CI workflow to test and deploy that branch;
- inspect the deployment job through completion;
- verify the deployed preview/result when tooling permits;
- report the deployed branch/preview and any deployment failure clearly.

Do not say a branch is deployed merely because a deployment workflow was triggered. A failed or skipped deploy is not deployed.

Deployment authorization does **not** imply authorization to merge to `main`.

## 6. Completion checklist

Before reporting a change complete, confirm:
1. product scope reviewed;
2. architecture/engineering scope reviewed;
3. branch name describes the actual feature/fix;
4. a matching draft PR exists;
5. implementation addresses the general case;
6. relevant tests were added/updated;
7. PR CI was inspected through completion and is green;
8. the deployment job completed successfully, or an exact blocker was reported;
9. `main` was not merged without explicit authorization.

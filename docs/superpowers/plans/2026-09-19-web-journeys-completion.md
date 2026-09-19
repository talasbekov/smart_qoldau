# Complete web journeys — implementation plan

Approved by user 2026-09-19 after the functional audit. No new automated tests; existing code preserved. Validate with type checking, builds, source review and manual browser journeys. Four concurrent sessions maximum including orchestrator. Check worker status every ~3 minutes; no workers spawn more agents. Do not commit, reset, deploy, install dependencies or run shared builds from workers.

Goal: independently usable client and expert journeys from onboarding through consultation completion, retaining existing Nest authority and BFF/session safety.

## Ownership and dependencies

- Orchestrator ONLY: auth and demo auth, Header, all existing layouts, middleware, API proxy route, shared ru/kz JSON, Session/Chat/call adapter, consultation lifecycle, deploy and whole-app build. Integrates requested API allowlist/form-data changes.
- Worker onboarding ONLY: new `/expert-onboarding` page in `(onboarding)`, new expert profile page under existing expert group; new `components/expert-onboarding/*`; existing backend experts read-only unless explicitly coordinated. Must use actual API; no bypass of verification.
- Worker expert desk ONLY: ExpertNav, WorkStatusToggle, OfferList, WeekSchedule, DashboardStats, expert home/offers/schedule pages and new expert desk components; backend schedule/experts read-only. No shared layouts/auth/translation JSON edits.
- Worker client journey ONLY: PaymentCheckout, BookingFlow, RequestForm, RequestStatus, ReviewPanel, client profile/new request pages; new payment methods page/components; backend requests and payment methods controller/service. No shared proxy/auth/layout/translation JSON edits.

Each worker may create a scoped typed RU/KZ copy module. Report API needs immediately. Preserve prior uncommitted changes. Different directories/routes must not duplicate the same URL.

## Ordered deliverables

1. Session-aware navigation and support retaining role-specific cabinet; canonical expert detection; explain states.
2. Expert application/profile/documents/status; client payment-method setup and resume; explicitly isolated demo login on test deployment, no production auth shortcut.
3. Expert incoming offer visible throughout cabinet, server deadline countdown, accurate availability reason; client cancel/recover request and no-experts actions.
4. Payment/format/status synchronization, visible participant readiness, chat→audio→video, leave versus complete, review and repeat consultation.
5. Integrate, inspect each diff, run one coordinated build per app after workers finish. Fix integration issues centrally.
6. Manual fresh-user journeys in disposable/local source build, then authorized VPS deployment with backup and public smoke verification. Report working paths and remaining external provider limitations without fabricated completion percentages.

Acceptance: no SQL, SSH logs, manual refresh or guessed URL is required by an ordinary participant to complete the supported demo journey. Expert approval stays an administrator's intentional action, not a participant bypass.

## Completion record

2026-09-19: deliverables 1–6 implemented and integrated. Real two-party browser journey passed locally with fresh client/expert and administrator verification, then on public VPS with fresh client and existing verified demo expert. Backend/web builds passed; no new automated tests. Deployment backed up, healthy, final read-only-history smoke passed. Evidence and untested limits: `docs/qa/web-journeys-2026-09-19/report.md`; user manual: `manual-test.md` beside it. Real providers, autoaccept and expanded calendar remain separate product gaps; no claim of complete MVP readiness.

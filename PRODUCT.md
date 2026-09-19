# Upcoded CRM

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated to Codex. Recommended for the zero-cost MVP: Next.js with TypeScript, Tailwind CSS and accessible headless components; Cloudflare Pages/Workers for hosting; Supabase for PostgreSQL and Google authentication; Inngest for durable background jobs; Tavily's free allowance for web discovery. Local execution must remain available as a fallback.

## Users

The sole initial user is Juan, owner of Upcoded, authenticated exclusively with the verified Google account `upcodednow@gmail.com`.

## Product Purpose

Upcoded CRM is the private operating panel for Upcoded. Its first and highest-priority capability is discovering, verifying, qualifying and managing potential web-development clients without fabricating businesses, websites, contact details or digital problems.

Success means that Juan can define a niche and one or more precise locations, receive a temporary batch of evidence-backed prospects, save the useful ones into a permanent CRM pipeline, and prepare credible personalized outreach from one interface.

## Positioning

Unlike a generic lead database, every prospect must show why it is an opportunity, how recently it was verified, which sources support each claim and how confident the system is. Unverified absence is never presented as fact.

## Operating Context

- The product is an internal operational tool, not a public SaaS.
- New searches are launched on demand by niche and geographic scope.
- Unsaved prospects expire after 24 hours.
- Saved, contacted or CRM-promoted prospects persist indefinitely.
- The user reviews evidence before contacting a business.
- The current folder contains historical HTML and JSON reports that may be used as migration fixtures, not as trusted current data.

## Capabilities and Constraints

- Login must only allow the verified Google identity `upcodednow@gmail.com`.
- The MVP must use services with a zero-cost tier and must stop processing when a quota is exhausted; it must never enable automatic paid overages.
- Geography must support multiple simultaneous scopes and the administrative hierarchy appropriate to each jurisdiction.
- Argentina is the initial country. Official GeoRef data supplies provinces, departments, municipalities and localities. Official city datasets may extend this with neighborhoods, beginning with CABA.
- The location flow must support `Argentina > Ciudad Autónoma de Buenos Aires > Recoleta` and `Argentina > Buenos Aires > Vicente López > Olivos` without pretending that every province has the same hierarchy.
- Prospect discovery, website analysis and outreach generation must be auditable and explainable.
- When Instagram or another source cannot be inspected, the result must be marked for manual review rather than inferred.
- Vercel Hobby is not an approved production target because its terms restrict it to personal, non-commercial use.

## Brand Commitments

- Product name: Upcoded CRM.
- Parent brand: Upcoded (`upcoded.dev`).
- Voice: direct, technically credible, Argentine Spanish, concise and human; no inflated claims or generic agency language.
- Durable value propositions: direct access to the developers, delivery in weeks, clear scope and pricing, high-performance digital products.

## Evidence on Hand

- Existing prospecting instructions: `.claude/skills/prospeccion-firecrawl.md`.
- Historical campaign data in the root JSON files.
- Historical generated reports in the root HTML files.
- Upcoded's public positioning and service information at `https://upcoded.dev/es`.
- No production CRM code, reusable database schema or stable scoring engine exists yet.

## Product Principles

1. Evidence before score.
2. Uncertainty is visible, never hidden behind confident copy.
3. Temporary discovery and permanent CRM data are separate lifecycles.
4. One operational surface replaces isolated campaign reports.
5. Automation proposes; Juan decides whom to contact.

## Accessibility & Inclusion

The dashboard must meet WCAG 2.2 AA for contrast, keyboard navigation, focus visibility and form labeling. Core workflows must remain usable on desktop and mobile, although dense prospect review is desktop-first.

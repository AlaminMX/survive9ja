

# SURVIVE NIGERIA — Complete Platform Plan

## Phase 1: Foundation & Design System
- Set up custom color palette (deep green primary, gold accent, cool grays) and typography (Bricolage Grotesque + Satoshi from Fontshare)
- Configure Tailwind theme with all design tokens from the brief
- Build core reusable components: Button (with scale hover/tap), Card, Input (48px height, focus ring), and layout primitives
- Create the "Certificate of Survival" SVG badge/seal component (gold circle with arc text)

## Phase 2: Public Marketing Website (Single Page)
A mobile-first, single-column stacked layout with these sections:
1. **Hero** — Headline, subtext, credibility badge, ₦300 CTA + "See How It Works" secondary CTA
2. **How It Works** — 4-step visual flow (Sign up → Questionnaire → Learning path → Certificate)
3. **7 Pillars** — Icon cards for each pillar with descriptions
4. **Sample Modules** — Preview cards for 6 example modules with titles, descriptions, and mock PDF previews
5. **Pricing** — Single confident card: ₦300 Starter Kit with features list and "Enroll Now" button
6. **Testimonials** — 3 short user stories
7. **FAQ** — Accordion with common questions
8. **Newsletter Signup** — Simple email capture form
9. **Footer** — Links, #survive9ja branding

## Phase 3: Backend Setup (Lovable Cloud / Supabase)
- **Database tables:** profiles, pillars, modules, enrollments, user_module_progress, certificates, newsletter_subscribers
- **User roles table** for admin access (using security-definer function pattern)
- **Storage buckets** for module materials (PDFs, guides, checklists)
- **RLS policies** on all tables
- **Sample data seed:** 7 pillars with 2-3 modules each, realistic Nigerian content

## Phase 4: Authentication
- Sign up (full name, email, phone, password)
- Log in / Log out
- Password reset flow with `/reset-password` page
- Auth context provider with protected routes

## Phase 5: Payment Flow (Paystack — Placeholder)
- Build the full payment integration structure with an edge function for Paystack
- Initialize transaction → redirect to Paystack → webhook verifies → create enrollment
- For now: mock payment flow that simulates success so the full UX works end-to-end
- When you add Paystack keys later, it goes live with no code changes

## Phase 6: Learner Dashboard
- **Welcome message** with user's first name
- **Progress bar** showing overall completion percentage
- **Module list** (dense list layout, not cards) with completion status icons
- **"Continue Learning" button** linking to next incomplete module
- **Certificate status** indicator
- Mobile: bottom tab bar (Dashboard / Modules / Profile)
- Desktop: fixed sidebar navigation

## Phase 7: Module Pages
- Module content area (video embed or slide presentation placeholder)
- Downloadable materials section (PDF guide, quick reference card, workbook, checklist)
- "Mark as Completed" button with loading state → updates progress
- Auto-advance to next module suggestion

## Phase 8: Certificate System
- Triggered when all assigned modules are completed
- Beautiful HTML certificate page with:
  - User's full name, program name, completion date
  - Unique certificate ID
  - QR code linking to a public verification URL (`/verify/[certificate-id]`)
  - Certificate of Survival gold seal
- "Download" (browser print-to-PDF) and "Share on Social Media" buttons
- Public `/verify/[id]` page for certificate verification

## Phase 9: Admin Panel
- Admin-only routes protected by role check
- **User Management:** Searchable/filterable user table, enrollment dates, per-user progress view
- **Course Management:** CRUD for pillars and modules, file upload for materials (PDF, video link, slides, workbook, infographic, checklist)
- **Analytics Dashboard:** Total users, total revenue, daily enrollments chart, module completion rates (using Recharts)

## Design Principles Throughout
- Mobile-first, single-column layouts
- No gradients, no heavy images, no parallax
- Minimal JS animations (CSS transforms for interactions)
- Deep green (#0B6B3A) + gold accent + cool gray palette
- All text WCAG AA compliant
- Dense but clear information hierarchy


# Survive9ja

Discuss. Express. Build. Survive.

The Square hosts public discussions about life in Nigeria. The Diaries hosts firsthand stories. The Community is the public profile layer. Reading and participation are free.

## Local preview

```sh
npm ci
npm run dev -- --port 4173
npm run build
npm run lint
```

Open http://localhost:4173. Vite development with no Supabase settings shows labelled fictional content and disabled account and publishing controls. The sample records are never written to the database. The production build excludes the fixtures and requires Supabase to load the feeds.

## Supabase and Vercel

1. Create a Supabase project and run the SQL files in order, as the project owner, in the Supabase SQL editor. Start with `202611180001_accounts.sql`, then apply `202611180002_square.sql`, `202611180003_moderation.sql`, and `202611180004_diaries.sql`. Each file is transactional and can be rerun after its prerequisites. To replay the full set, run it in numeric order. Keep the private schema out of the exposed Data API schemas.
2. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` to your project URL and `VITE_SUPABASE_ANON_KEY` to your public anon key. Restart Vite after editing these values. Service-role keys, SMTP credentials and OAuth secrets belong in the relevant provider settings.
3. In Supabase Authentication URL Configuration, set **Site URL** to the canonical Vercel origin. Add both `/auth` and `/auth?reset=1` for that origin to **Redirect URLs**, and add `http://localhost:4173/auth` and `http://localhost:4173/auth?reset=1` for local testing. Add these same paths for each preview hostname you intend to test. Use the exact scheme and hostname for each deployment.
4. Enable the Email provider and **Confirm email**. Keep the confirmation and password recovery templates wired to `{{ .ConfirmationURL }}`. Set up SMTP for the pilot and verify mail delivery before inviting members.
5. In Google Cloud, create a web OAuth client and register `https://<project-ref>.supabase.co/auth/v1/callback` as its authorised redirect URI. In Supabase Authentication Providers, enable Google and enter that client ID and secret. Configure the Google consent screen and add pilot test users if the app is in testing mode.
6. Import the source into Vercel using the Vite preset. Set both public Vite variables in the desired environments, build with `npm run build`, and publish `dist`. `vercel.json` rewrites deep links to the SPA. Confirm `/auth`, `/diaries` and a public profile open directly on the final deployment URL.

Signup creates a private provisional profile. After email confirmation or Google sign-in, the member completes their profile and accepts both draft-1 policies. The legal pages are drafts and should be reviewed before launch.

### Grant moderator or admin access

Find the confirmed user in Supabase Authentication and copy their UUID. Run this in the SQL editor. The account must also complete onboarding before using `/admin`.

```sql
insert into public.user_roles (user_id, role)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid, 'admin')
on conflict (user_id, role) do nothing;
```

Use `moderator` for the same pilot moderation permissions. `/admin` shows up to 50 open reports, oldest first. Actions are logged with actor, target, report, time and note. Resolve closes a report. Use its ID under recent reports to reopen the review context for restore or unban.

## Feed and publication rules

- Latest sorts by creation time then UUID, both descending. Trending scores discussions from the preceding seven days using `(reactions + 2 × visible replies) / (hours since posting + 2)^1.5`. Reactions to the discussion itself count toward its score. Activity under hidden roots and replies beneath hidden parents is excluded. Score ties use Latest ordering. The cursor holds score, creation time and UUID and the feed uses a fixed timestamp until refreshed. Moderation still takes effect immediately on subsequent reads.
- In Nigeria matches the public country of Nigeria. Diaspora matches the public Based abroad opt-in. Anonymous diaries are excluded from both location filters. Public histories list named, visible top-level content.
- Verified, onboarded and unrestricted members get 10 discussions and 60 replies per UTC day. Diary authors must also have a 24-hour-old account and get five stories per UTC day. Reply quotas are shared across The Square and The Diaries. Limit counters use an atomic upsert inside the publication transaction. Membership restrictions and publication are serialised per account.
- Anonymous publication defaults off in the editor and is disabled at the database level. Keep it disabled until the deployed Data API checks below pass. After verification, a project owner can enable it with `update community_private.pilot_config set anonymous_diaries = true where singleton;`. Use the same statement with `false` to stop new anonymous publications. Existing stories retain their original attribution. Private owner editing is available from profile settings.

## Pilot smoke test on the deployed backend

Use a signed-out browser, a newly confirmed member, an older verified member, and a separate moderator. Check network responses using both anon and ordinary member sessions.

1. Register by email, confirm from the inbox, and verify that the provisional profile cannot be read publicly. Complete onboarding with both policies checked. Attempt a duplicate username from the second account and check the readable error. Repeat onboarding via Google. Test email/password login, sign-out and password reset through the emailed link.
2. Publish Square discussions and use Latest, Trending, categories and public location filters. With more than eight matching posts, use Load more and verify there are no duplicates on a static feed. Add a reply and one child reply. Verify a further nested reply fails. Switch a reaction and verify the count stays at one. Try participation from a provisional account and confirm it fails.
3. Report a discussion and a reply using the sensitive information reason. Verify the ordinary member receives permission errors when calling moderation RPCs directly and cannot read private tables or alter roles. Sign in as moderator. Review context, hide the parent, verify public detail and feed omit it, restore it, and check that hiding a reply also suppresses its children. Ban the author, verify publishing and replying fail, then unban and retry. Resolve the report and verify the audit row in the SQL editor.
4. On a disposable project, send simultaneous eligible requests with separate connections or HTTP clients. Start from nine discussions, 59 replies and four diaries for one account. Confirm only one request in each pair succeeds, the counters stay at the caps, and a separate account is unaffected.
5. Verify a new member sees the 24-hour message in the editor and is rejected by the publish RPC. An older member should be able to publish and edit a named story. Try editing it as another account and verify denial. Change a diary reaction from I relate to Respect and verify that only the I relate count decreases. Check the mobile editor and reading column.
6. Keep anonymity off in production while testing on a disposable Supabase project. Enable the switch there and publish one anonymous diary. Verify the unchecked default, the anonymous byline and the author warning. From signed-out and ordinary member sessions, inspect `feed`, `read_thread` and `public_profile` network payloads, both location filters, and reaction payloads. The anonymous diary should have `author: null` and `owned: false`, with no author ID, profile link, avatar, location or anonymous entry in public profile history. Call the private owner functions as the other member and verify they reveal no owner data. Verify named replies remain named. Confirm the moderator queue has no anonymous author ID. Call the identity lookup as an ordinary member, then as a moderator with a note, and verify that only the latter succeeds and writes exactly one audit row. Hide the story and verify it disappears from public reads and activity.

## Local handoff

Chromium captures are in `work/screenshots/`. The local SQL checks used PGlite and native PostgreSQL with separate roles and Supabase-style identity claims. Two independent PostgreSQL connections tested concurrent submissions at each quota. Supabase Auth delivery, Google consent, deployed PostgREST responses and Vercel routing still require the project setup above.

### If the deployed feed says Supabase is missing

Vite reads the public configuration during the Vercel build. Set the project URL and the Supabase **publishable** key or legacy **anon** key on the exact Vercel project serving the domain you use. Use `VITE_SUPABASE_URL` with `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`). The build also recognises matching public pairs supplied by the integration under `NEXT_PUBLIC_SUPABASE_` or `SUPABASE_`. Keep the two values in the same environment scope and use values from the same Supabase project. Use the Production scope for your live domain and redeploy after changes.

Once a deployment has configuration, an empty feed is normal on a new project. A missing `public.feed` function indicates that the migrations still need to be applied in Supabase. After applying the four migrations and setting the Auth redirects for the live domain, use a test account to sign up, confirm your email, complete onboarding and publish the first discussion. See the pilot smoke test above before inviting members.

The full Survive9ja logo is served at `/survive9ja-logo.svg`. The header and favicon share `/brand-mark.svg`.

### Signup confirmation and branded email

In Supabase **Authentication → URL Configuration**, set **Site URL** to the live site origin and add the full onboarding URL (for example, `https://survive9ja.vercel.app/onboarding`) to **Redirect URLs**. Add the equivalent `/onboarding` URL for each local or preview origin that sends signup emails. Keep the existing `/auth` and `/auth?reset=1` entries for Google sign-in and password recovery. Send a new confirmation email after changing the settings. The sign-in page has a **Resend confirmation** action.

In Supabase **Authentication → SMTP Settings**, enable custom SMTP using an email provider with a verified sender address. Set **Sender name** to **Survive9ja**. Enter the provider's host, port and SMTP credentials in Supabase. In **Authentication → Email Templates → Confirm signup**, set the subject to **Confirm your email for Survive9ja** and paste `supabase/templates/confirm-signup.html` as the body. Keep `{{ .ConfirmationURL }}` so Supabase verifies the email before redirecting to onboarding. If the provider has click tracking for transactional email, disable it for these authentication links. Test with a new account and check both the From name and the destination.

### Profile photo upload

Apply `202611180005_avatars.sql` in the Supabase SQL Editor after the first four migrations. It provisions the public `survive9ja-avatars` bucket for cropped JPEGs and limits each upload to the signed-in user's own folder. The user crops the image in the browser before saving. The profile uses the resulting 512 × 512 JPEG, and the original stays on the device. Removing a photo clears it from the profile. Existing profile images continue to display until replaced or removed.

To check setup, choose a portrait or landscape JPG, PNG or WebP under 10 MB in profile settings. Zoom or reposition the crop, click **Use this crop**, and save. Check that the public profile displays the same circular framing and that another member cannot upload to the first member's storage folder.

## Survival Levels, Business Hub and credits

Apply the `community_expansion.sql` migration in filename order after the avatar migration. These changes use the existing Supabase accounts and moderator roles.

- At `/survival/awards`, members submit a visible named Diary with five short rubric responses and a three-question quiz. The submission contributes 20 points, correct answers 15 each, useful votes 2 each and vouches 3 each, with at most 35 voting points. Each eligible member can give one changeable vote per story. Level 2 needs 45 points and one correct answer. Level 3 needs 65 points, two correct answers and feedback from at least two members. Levels 4 and 5 need 80 or 90 points, all three answers and a separate moderator approval. The rubric scores completion and practical participation. Reviewers can assess the story's context and response for Levels 4 and 5. Awards represent community participation and can be withdrawn from public display by the holder.
- The public verification page only displays shared certificates to visitors. A signed-in holder can view and print their own private certificate. Anonymous Diaries are ineligible for the award workflow. A hidden story or banned account cannot produce a current public award. The Business Survivors directory checks the current Level 3 qualification in the database for both reading and publishing.
- Business profiles, product and service listings, initiatives and collaboration posts are available at `/business`. Listings and edits enter the admin queue before publication. Members can report listings, and moderators can publish, hide or restore them.
- Credit Book tracks earned, purchased and spent credits. A member who earns a Survival Level can claim one participation credit once. One credit buys a 24-hour post or public listing boost. Sponsored placements are labelled and separate from the organic ranking.

### Payment setup

Set `PAYSTACK_SECRET_KEY`, `PAYSTACK_MODE`, and `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` in the Vercel server environment. Use the existing Supabase project URL and publishable client key. Keep all secret keys server-side. Set `SURVIVE9JA_SITE_URL` if using a different HTTPS domain. The callback is `/credits?checkout=1`, and the Paystack webhook is `/api/paystack/webhook`. Use Paystack test credentials with a separate Supabase test project. Vercel production requires `PAYSTACK_MODE=live` and a live key. Update environment variables and redeploy before testing.

Credit packs are inactive until configured. A project owner can insert approved packs through the SQL editor using the columns `id`, `credits`, `amount_kobo` and `active` on `community_private.credit_packs`. Store amounts in kobo. Activate packs after verifying checkout on a test project. The server verifies Paystack signatures and independently checks each payment before crediting the ledger. The credit entry is unique per payment reference.

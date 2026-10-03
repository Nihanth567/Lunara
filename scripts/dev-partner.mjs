// Create a test partner — with a couple, tonight already written, and an item
// on the shared list — and print the invite code, so a developer can test
// Lunara as the joining partner without Sign in with Apple (which an unsigned
// simulator build can't do) and without a second phone.
//
// Usage: npm run dev:partner
//
// In the app: Welcome → "Your partner sent you a code? Join them" → any name +
// the code below. The test partner is marked subscribed (as RevenueCat's
// webhook would after a real trial), so the joining partner goes straight in.
//
// Uses only the public Supabase URL and anon key from .env, except for the
// subscription flag, which needs SUPABASE_SERVICE_ROLE_KEY in the environment
// (never in .env, never committed). Without it the couple still works, but the
// app shows the paywall unless .env has no RevenueCat key (then dev builds
// skip it — see README).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (ask the project owner).');
  process.exit(1);
}

const partner = createClient(url, anon, { auth: { persistSession: false } });
const name = process.argv[2] ?? 'Test Partner';
const { data: auth, error: authError } = await partner.auth.signInAnonymously({ options: { data: { name } } });
if (authError) {
  console.error(`Couldn't create the partner: ${authError.message}`);
  console.error('Is "Allow anonymous sign-ins" on in Supabase → Authentication → Sign In / Providers?');
  process.exit(1);
}
const userId = auth.user.id;

const { data: couple, error: coupleError } = await partner.rpc('create_couple', { p_user_name: name });
if (coupleError) {
  console.error(`Couldn't create the couple: ${coupleError.message}`);
  process.exit(1);
}

const today = new Date().toLocaleDateString('en-CA'); // the device's local date, like the app
await partner.from('entries').upsert(
  {
    couple_id: couple.id,
    date: today,
    user_id: userId,
    grateful: 'You made me laugh after a long day.',
    cute: 'The way you hum while you cook.',
    grow: 'I want to listen more before I answer.',
    submitted: true,
  },
  { onConflict: 'couple_id,date,user_id' },
);
await partner.from('list_items').insert({
  couple_id: couple.id,
  title: 'Book a weekend away',
  note: '',
  needs_both: true,
  created_by: userId,
  position: 1,
});

let subscribed = false;
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await admin.from('profiles').update({ is_subscribed: true }).eq('id', userId);
  subscribed = !error;
}

console.log(`
Test partner "${name}" is ready, and has written tonight.

  Invite code:  ${couple.invite_code}

In the app: Welcome → "Your partner sent you a code? Join them" → any name + the code.
${subscribed
  ? 'The partner is marked subscribed, so you go straight into the app.'
  : 'Not marked subscribed (no SUPABASE_SERVICE_ROLE_KEY). Leave EXPO_PUBLIC_REVENUECAT_IOS_API_KEY empty in .env so a dev build skips the paywall.'}
To clean up: delete "${name}" under Supabase → Authentication → Users.
`);
process.exit(0);

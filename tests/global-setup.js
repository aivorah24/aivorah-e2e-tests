// Runs ONCE before the whole test run starts (see playwright.config.js).
//
// It does two jobs:
//
// 1. LOG IN once per account and save the session to .auth/. Every test then
//    starts already logged in instead of typing the password itself - the
//    difference between ~9s and ~0.3s per test, which is what keeps the whole
//    suite inside 15 minutes.
//
// 2. SNAPSHOT the accounts our tests change, so global-teardown.js can put
//    them back afterwards. Without this, every run leaves the accounts a bit
//    more edited and later runs start from a different place - which is
//    exactly how tests turn flaky.
//
// Why here and not in the test files? Because tests run in PARALLEL across
// several workers. A beforeAll() runs once PER WORKER, so a worker starting
// late would "snapshot" an account another worker had already changed, then
// restore that mess as if it were the original. Global setup runs exactly
// once, before any worker starts, so it can't get that wrong.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const SNAPSHOT_FILE = path.resolve(__dirname, '..', '.profile-snapshot.json');

export default async function globalSetup(config) {
  // Imported here, not at the top, so the .env values above are already loaded
  // before these modules build their Supabase / account connections.
  const { snapshotProfile } = await import('./helpers/resetProfile.js');
  const { harvestSession, AUTH_DIR } = await import('./helpers/auth.js');
  const { ACCOUNTS, PASSWORD, accountFor } = await import('./helpers/accounts.js');

  const baseURL = config.projects[0].use.baseURL;

  // Start clean - a stale session from an earlier run would silently log a
  // test in as the wrong account.
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });

  // 1. Log in once per account - a few at a time, not all 17 at once. Firing
  //    every login simultaneously overloads the local dev server, and the
  //    slow ones then time out for no real reason.
  //
  //    Two at a time, not four: each login opens a browser window loading the
  //    whole app, which is heavy on memory. On an 8GB machine four at once ran
  //    Windows out of RAM, the browser got killed mid-run, and setup died with
  //    a confusing "Failed to find browser context" error. Two is slower by
  //    about 40 seconds - nothing against the 15 minute budget.
  const BATCH_SIZE = 2;
  const keys = Object.keys(ACCOUNTS);
  const browser = await chromium.launch();

  try {
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);

      // allSettled, not all.
      //
      // Promise.all stops at the FIRST login that fails - but the rest of the
      // batch is still going. We'd then close the browser underneath them,
      // they'd fail with a confusing "Failed to find browser context" error,
      // and since nobody is waiting on them anymore Node crashes on the spot.
      // The real reason the first login failed never gets printed.
      //
      // allSettled waits for the whole batch to finish, then we report what
      // actually went wrong, per account.
      const results = await Promise.allSettled(
        batch.map((key) =>
          harvestSession(browser, {
            account: key,
            email: accountFor(key).email,
            password: PASSWORD,
            baseURL,
          }),
        ),
      );

      const failures = results
        .map((r, n) => (r.status === 'rejected' ? `${batch[n]} -> ${r.reason.message}` : null))
        .filter(Boolean);

      if (failures.length) {
        throw new Error(
          `Could not log in ${failures.length} account(s):\n  ${failures.join('\n  ')}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  // 2. Snapshot only the accounts that get written to. Read-only accounts are
  //    never changed, so there's nothing to put back.
  const mutable = Object.entries(ACCOUNTS).filter(([, a]) => a.mutable);
  const snapshots = {};
  for (const [key, account] of mutable) {
    snapshots[key] = { email: account.email, snapshot: await snapshotProfile(account.email) };
  }

  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshots, null, 2));
}

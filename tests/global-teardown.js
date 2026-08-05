// Runs ONCE after the whole test run finishes (see playwright.config.js).
//
// Reads the snapshots global-setup.js saved and writes them back, so every
// account the tests changed ends up exactly how it started.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const SNAPSHOT_FILE = path.resolve(__dirname, '..', '.profile-snapshot.json');

export default async function globalTeardown() {
  // No snapshot file means setup never got that far - nothing to put back.
  if (!fs.existsSync(SNAPSHOT_FILE)) return;

  const { restoreProfile } = await import('./helpers/resetProfile.js');
  const snapshots = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));

  // Put every account back. If one fails we still try the rest - leaving four
  // accounts dirty because the fifth errored would be worse.
  const failures = [];
  for (const [key, { email, snapshot }] of Object.entries(snapshots)) {
    try {
      await restoreProfile(email, snapshot);
    } catch (error) {
      failures.push(`${key} (${email}): ${error.message}`);
    }
  }

  fs.unlinkSync(SNAPSHOT_FILE);

  if (failures.length) {
    throw new Error(`Could not restore these accounts:\n  ${failures.join('\n  ')}`);
  }
}

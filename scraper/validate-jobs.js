/**
 * Generic Deep Job URL Validator (manual use)
 *
 * Full GET + body scan for expired keywords. Slower than the HEAD-only CI
 * validator, but catches soft-404s where the HTTP status is 200 but the
 * page body says "no longer available".
 *
 * Delegates to:
 *   - job-validator.js  — validateByContent (deep GET + keyword scan)
 *   - api.js            — querySOLR, deleteJobByUrl (via Peviitor API)
 *
 * Usage:
 *   node scraper/validate-jobs.js <CIF>         — validate all jobs in SOLR by CIF
 *   node scraper/validate-jobs.js url <url>     — validate a single URL
 *   node scraper/validate-jobs.js <CIF> --delete — validate + delete invalid
 */

import { querySOLR, deleteJobByUrl } from "./api.js";
import { validateByContent } from "./job-validator.js";

async function validateJobs(cif, doDelete = false) {
  console.log(`=== Validating jobs for CIF: ${cif} ===\n`);

  const result = await querySOLR(cif);
  console.log(`Total jobs in SOLR: ${result.numFound}`);

  if (result.numFound === 0) {
    console.log("No jobs to validate.");
    return;
  }

  const invalid = [];
  for (const job of result.docs) {
    const check = await validateByContent(job.url);
    const statusIcon = check.status === "active" ? "✅" : check.status === "expired" ? "❌" : "⚠️";
    console.log(`${statusIcon} [${check.httpStatus}] ${job.title}`);
    if (check.status !== "active") invalid.push(job);
  }

  if (invalid.length === 0) {
    console.log("\n✅ All jobs valid");
    return;
  }

  console.log(`\n⚠️  ${invalid.length} invalid job(s) found`);
  for (const job of invalid) {
    console.log(`  - ${job.title}: ${job.url}`);
  }

  if (doDelete) {
    console.log("\nDeleting invalid jobs...");
    let deleted = 0;
    for (const job of invalid) {
      await deleteJobByUrl(job.url);
      deleted++;
      console.log(`  ✅ Deleted: ${job.title}`);
    }
    console.log(`\n✅ Deleted ${deleted}/${invalid.length} invalid job(s)`);
  } else {
    console.log('\nUse --delete to remove invalid jobs from SOLR.');
  }
}

async function validateSingleUrl(url) {
  console.log(`Validating single URL:\n  ${url}\n`);
  const check = await validateByContent(url);
  const statusIcon = check.status === "active" ? "✅" : check.status === "expired" ? "❌" : "⚠️";
  console.log(`${statusIcon} Status: ${check.status} (HTTP ${check.httpStatus})`);
  if (check.title) console.log(`   Title: ${check.title}`);
  if (check.error) console.log(`   Error: ${check.error}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage:");
    console.error("  node scraper/validate-jobs.js <CIF>              — validate all jobs by CIF");
    console.error("  node scraper/validate-jobs.js url <url>          — validate a single URL");
    console.error("  node scraper/validate-jobs.js <CIF> --delete     — validate + delete invalid");
    process.exit(1);
  }

  const doDelete = args.includes("--delete");
  const positional = args.filter(a => a !== "--delete");

  if (positional[0] === "url") {
    await validateSingleUrl(positional[1]);
  } else {
    await validateJobs(positional[0], doDelete);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

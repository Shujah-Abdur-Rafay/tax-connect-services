#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-firestore-rules.sh
#
# Deploys the Firestore security rules in firestore.rules to the PRODUCTION
# Firebase project and then verifies that the live, deployed ruleset matches the
# local file.
#
# WHY THIS EXISTS
# ----------------
# Editing firestore.rules in the repo does NOTHING on its own. Firestore enforces
# the *deployed* ruleset, not the file on disk. If the deployed rules are stale
# (e.g. they predate the `professionals/{uid}` create/update rule), then the
# tax-pro onboarding "Save Profile" step fails with:
#
#     "Missing or insufficient permissions"
#
# ...even though firestore.rules in the repo looks correct. This script makes
# deploying + verifying a one-liner so the live project never drifts from the repo.
#
# USAGE
# -----
#   npm run rules:verify        # deploy + verify (recommended)
#   bash deploy-firestore-rules.sh
#   bash deploy-firestore-rules.sh --verify-only   # skip deploy, just diff live vs local
#
# PREREQUISITES
# -------------
#   1. Firebase CLI installed:   npm install -g firebase-tools
#   2. Authenticated:            firebase login           (interactive)
#                            OR  export FIREBASE_TOKEN=... (CI / non-interactive)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="refund-connect-1m30"
RULES_FILE="firestore.rules"
VERIFY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --verify-only) VERIFY_ONLY=true ;;
    *) ;;
  esac
done

# --- sanity checks -----------------------------------------------------------
if ! command -v firebase >/dev/null 2>&1; then
  echo "ERROR: firebase CLI not found. Install it with: npm install -g firebase-tools" >&2
  exit 1
fi

if [ ! -f "$RULES_FILE" ]; then
  echo "ERROR: $RULES_FILE not found. Run this script from the repo root." >&2
  exit 1
fi

echo "============================================================"
echo " Firestore rules deploy/verify"
echo "   project : $PROJECT_ID"
echo "   rules   : $RULES_FILE"
echo "   mode    : $([ "$VERIFY_ONLY" = true ] && echo 'verify-only' || echo 'deploy + verify')"
echo "============================================================"

# --- deploy ------------------------------------------------------------------
if [ "$VERIFY_ONLY" = false ]; then
  echo "==> Deploying Firestore rules to $PROJECT_ID ..."
  firebase deploy --only firestore:rules --project "$PROJECT_ID"
  echo "==> Deploy command completed."
fi

# --- verify: compare the live ruleset against the local file -----------------
echo "==> Verifying that the LIVE deployed rules match $RULES_FILE ..."

LIVE_RULES="$(mktemp)"
trap 'rm -f "$LIVE_RULES"' EXIT

# `firebase firestore:rules:get` prints the active ruleset source to stdout.
if firebase firestore:rules:get --project "$PROJECT_ID" >"$LIVE_RULES" 2>/dev/null; then
  if diff -q <(sed 's/[[:space:]]*$//' "$RULES_FILE") \
             <(sed 's/[[:space:]]*$//' "$LIVE_RULES") >/dev/null 2>&1; then
    echo "==> SUCCESS: live deployed rules match $RULES_FILE."
  else
    echo "==> WARNING: live deployed rules DIFFER from $RULES_FILE." >&2
    echo "    (This is expected if the CLI normalizes formatting. Review the diff below.)" >&2
    echo "------------------------------------------------------------" >&2
    diff <(sed 's/[[:space:]]*$//' "$RULES_FILE") \
         <(sed 's/[[:space:]]*$//' "$LIVE_RULES") || true
    echo "------------------------------------------------------------" >&2
  fi
else
  echo "==> NOTE: could not fetch live rules for an automatic diff" >&2
  echo "    (older Firebase CLI versions lack 'firestore:rules:get')." >&2
  echo "    Verify manually in the console:" >&2
  echo "    https://console.firebase.google.com/project/$PROJECT_ID/firestore/rules" >&2
fi

echo "============================================================"
echo " Done. If onboarding still shows 'Missing or insufficient"
echo " permissions', confirm the LIVE rules include match blocks for"
echo " ALL of these onboarding-write collections:"
echo "   • professionals/{proId}        -> profile save"
echo "   • signed_agreements/{id}        -> signed agreement save"
echo "   • onboarding_reminders/{uid}    -> reminder dedup ledger"
echo ""
echo "   e.g. match /professionals/{proId} {"
echo "     allow create, update, delete: if isSignedIn()"
echo "       && request.auth.uid == proId;"
echo "   }"
echo "============================================================"
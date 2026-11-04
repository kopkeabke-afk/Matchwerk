#!/usr/bin/env bash
# Regenerates supabase/setup.sql (all migrations in one file for the Supabase SQL editor).
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "-- ============================================================"
  echo "-- Matchwerk – komplettes Datenbank-Setup für Supabase"
  echo "-- Einmal komplett in Supabase → SQL Editor einfügen und auf RUN klicken."
  echo "-- Enthält: $(ls supabase/migrations | tr '\n' ' ')"
  echo "-- ============================================================"
  for f in supabase/migrations/*.sql; do echo; echo "-- >>> $f"; cat "$f"; done
  echo
  echo "select 'Matchwerk-Datenbank ist eingerichtet' as fertig;"
} > supabase/setup.sql

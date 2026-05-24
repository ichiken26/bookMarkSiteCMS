#!/usr/bin/env bash
# Cloudflare Workers Builds 用（Node 22 必須: wrangler 4）
set -euo pipefail
npm run build-only
exec npx wrangler deploy

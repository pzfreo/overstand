#!/bin/bash

# Build script for diagram-creator PWA
# Supports Vercel, GitHub Pages, and local development

set -e  # Exit on error

echo "🚀 Starting build process..."

# ============================================================================
# ENVIRONMENT DETECTION
# ============================================================================

# Detect environment (Vercel, GitHub Actions, or local)
if [ -n "$VERCEL_ENV" ]; then
    # Running on Vercel
    ENVIRONMENT="$VERCEL_ENV"  # production, preview, or development
    COMMIT_SHA="${VERCEL_GIT_COMMIT_SHA:-unknown}"
    COMMIT_SHORT="${COMMIT_SHA:0:7}"
    DEPLOY_URL="${VERCEL_URL:-}"
    echo "📦 Building for Vercel ($ENVIRONMENT)"
elif [ -n "$GITHUB_ACTIONS" ]; then
    # Running on GitHub Actions
    if [ "$GITHUB_REF" == "refs/heads/main" ]; then
        ENVIRONMENT="production"
    else
        ENVIRONMENT="preview"
    fi
    COMMIT_SHA="${GITHUB_SHA:-unknown}"
    COMMIT_SHORT="${COMMIT_SHA:0:7}"
    DEPLOY_URL=""
    echo "📦 Building for GitHub Actions ($ENVIRONMENT)"
else
    # Local development
    ENVIRONMENT="development"
    COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "local-dev")
    COMMIT_SHORT="${COMMIT_SHA:0:7}"
    DEPLOY_URL="http://localhost:8000"
    echo "📦 Building for local development"
fi

# ============================================================================
# BUILD ID GENERATION
# ============================================================================

# Generate build ID (timestamp-based for cache busting)
BUILD_ID=$(date +%s)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get commit count for version number (monotonically increasing)
COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")

# Version format: v1.{env}.{number}
# - v1.prod.XX  = production (main branch)
# - v1.preview.YY = preview deploys (PRs)
# - v1.dev.local = local development
if [ "$ENVIRONMENT" == "production" ]; then
    VERSION="v1.prod.${COMMIT_COUNT}"
elif [ "$ENVIRONMENT" == "preview" ]; then
    VERSION="v1.preview.${COMMIT_COUNT}"
else
    VERSION="v1.dev.local"
fi

echo "  Environment: $ENVIRONMENT"
echo "  Version: $VERSION"
echo "  Commit: $COMMIT_SHORT"
echo "  Build ID: $BUILD_ID"

# ============================================================================
# CLEAN AND PREPARE
# ============================================================================

echo "🧹 Cleaning previous build..."
rm -rf public
mkdir -p public

# ============================================================================
# GENERATE VERSION.JSON
# ============================================================================

echo "📝 Generating version.json..."
cat > public/version.json << EOF
{
  "version": "${VERSION}",
  "commit": "${COMMIT_SHORT}",
  "commitFull": "${COMMIT_SHA}",
  "buildTime": "${BUILD_TIME}",
  "buildId": ${BUILD_ID},
  "environment": "${ENVIRONMENT}",
  "deployUrl": "${DEPLOY_URL}"
}
EOF

echo "  ✓ version.json created"

# ============================================================================
# PROCESS SERVICE WORKER
# ============================================================================

echo "🔧 Processing service worker..."

# Read the service worker template
SERVICE_WORKER_TEMPLATE="web/service-worker.js"
SERVICE_WORKER_OUTPUT="public/service-worker.js"

# Replace cache name placeholders with build-specific values
sed "s/__BUILD_ID__/${BUILD_ID}/g; s/__ENVIRONMENT__/${ENVIRONMENT}/g" \
    "$SERVICE_WORKER_TEMPLATE" > "$SERVICE_WORKER_OUTPUT"

echo "  ✓ Service worker processed (cache: neck-generator-v${BUILD_ID})"

# ============================================================================
# PROCESS ABOUT.MD
# ============================================================================

echo "📄 Processing about.md..."

# Replace {{version}} placeholder in about.md
sed "s/{{version}}/${VERSION}/g" web/about.md > public/about.md

echo "  ✓ about.md processed with version ${VERSION}"

# ============================================================================
# COPY WEB FILES
# ============================================================================

echo "📋 Copying web files..."

# Copy all web files except service-worker.js, version.json, and about.md (already processed)
for file in web/*; do
    filename=$(basename "$file")
    if [ "$filename" != "service-worker.js" ] && [ "$filename" != "version.json" ] && [ "$filename" != "about.md" ]; then
        if [ -d "$file" ]; then
            cp -r "$file" "public/"
        else
            cp "$file" "public/"
        fi
    fi
done

echo "  ✓ Web files copied"

# ============================================================================
# COPY PYTHON MODULES
# ============================================================================

echo "🐍 Copying Python modules..."
cp src/*.py public/
echo "  ✓ Python modules copied"

# ============================================================================
# COPY PRESETS
# ============================================================================

echo "🎵 Copying instrument presets..."
cp -r presets public/
echo "  ✓ Presets copied"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "✅ Build complete!"
echo ""
echo "Environment:  $ENVIRONMENT"
echo "Version:      $VERSION"
echo "Build ID:     $BUILD_ID"
echo "Cache Name:   neck-generator-v${BUILD_ID}"
echo "Commit:       $COMMIT_SHORT"
if [ -n "$DEPLOY_URL" ]; then
    echo "Deploy URL:   $DEPLOY_URL"
fi
echo ""
echo "Output directory: ./public"
echo ""

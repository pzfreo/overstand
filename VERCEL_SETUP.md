# Vercel Setup Guide

This guide will help you set up Vercel for automatic deployments with preview environments.

## What This Gives You

After setup, you'll have:
- ✅ **Automatic PR previews** - Every PR gets a unique preview URL
- ✅ **Production deployments** - Main branch auto-deploys to production
- ✅ **Dynamic cache versioning** - Users never stuck on old versions
- ✅ **Environment-aware updates** - Previews auto-update, production shows notification
- ✅ **6,000 build minutes/month** - Perfect for frequent deployments

## Prerequisites

- GitHub account with this repository
- Vercel account (free tier) - Create at https://vercel.com

## Setup Steps

### 1. Connect Vercel to GitHub

1. Go to https://vercel.com and sign in with GitHub
2. Click **"Add New Project"**
3. Select **"Import Git Repository"**
4. Find and select `overstand` repository
5. Click **"Import"**

### 2. Configure Build Settings

Vercel should auto-detect the static site, but verify these settings:

- **Framework Preset:** Other (or leave as auto-detected)
- **Root Directory:** `./` (leave empty)
- **Build Command:** `bash scripts/build.sh`
- **Output Directory:** `public`

Click **"Deploy"** to start your first deployment!

### 3. Verify Deployment

After the first deployment completes:

1. Visit the production URL (e.g., `https://overstand.tools`)
2. Open browser DevTools → Console
3. Look for messages like:
   ```
   [PWA] Environment: production, Version: 1.0.xxxx
   [ServiceWorker] Installing... (production, overstand-vXXXXXX)
   ```
4. Open DevTools → Application → Cache Storage
5. Verify you see cache named like `overstand-v1767298837`

### 4. Test PR Preview

1. Create a new branch: `git checkout -b test-preview`
2. Make a small change (e.g., edit README)
3. Commit and push: `git push -u origin test-preview`
4. Create a PR on GitHub
5. Wait ~1-2 minutes for Vercel to comment on the PR with preview URL
6. Click the preview URL to test your changes

### 5. Configure Custom Domain (Optional)

If you want a custom domain instead of `*.vercel.app`:

1. Go to Vercel dashboard → Your Project → Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions
4. Vercel auto-provisions SSL certificate

## How It Works

### Build Process

When you push code, Vercel:
1. Detects the environment (production, preview, development)
2. Runs `scripts/build.sh`
3. Generates `version.json` with build metadata
4. Injects build ID into service worker cache names
5. Deploys to appropriate environment

### Environment Detection

The system automatically detects three environments:

| Environment | Trigger | Cache Behavior | Update Behavior |
|-------------|---------|----------------|-----------------|
| **production** | Push to `main` | Cache-first, aggressive | Show update notification to user |
| **preview** | PR or branch push | Network-first | Auto-reload on new version |
| **development** | Local build | Network-first | Auto-reload on new version |

### Cache Versioning

Each build gets a unique cache name based on build ID:
- Production: `overstand-v1234567890`
- Preview: `overstand-v0987654321`

This ensures users never get stuck on old cached versions!

## Testing Locally

Before deploying, test the build locally:

```bash
# Run the build script
./scripts/build.sh

# Start a local server
cd public
python3 -m http.server 8000

# Open http://localhost:8000 in your browser
```

Check the browser console for:
```
[PWA] Environment: development, Version: dev-1234567890
[ServiceWorker] Installing... (development, overstand-v1234567890)
```

## Troubleshooting

### Build Fails on Vercel

Check the build logs in Vercel dashboard. Common issues:
- Missing `bash` - Vercel should have it by default
- Build script permissions - Already set with `chmod +x`
- Missing files - Ensure all files are committed to git

### Service Worker Not Updating

In browser DevTools:
1. Application → Service Workers
2. Check "Update on reload"
3. Unregister old service worker
4. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### Environment Not Detected

Check `version.json` in deployed site:
```javascript
fetch('/version.json').then(r => r.json()).then(console.log)
```

Should show correct environment field.

## Deployment Workflow

### For Features

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Push: `git push -u origin feature/my-feature`
4. Create PR → Vercel creates preview automatically
5. Share preview URL with stakeholders
6. Test thoroughly on preview
7. Merge PR → Deploys to production

### For Hotfixes

1. Create hotfix branch: `git checkout -b hotfix/urgent-fix`
2. Make fix and commit
3. Push and create PR
4. Test on preview deployment
5. Merge to main → Immediate production deploy

## Migration from GitHub Pages

If you want to keep GitHub Pages as backup:

1. Keep both deployments running
2. Update DNS to point to Vercel for production
3. Keep GitHub Pages workflow in `.github/workflows/` (commented out)
4. Can switch back anytime by re-enabling GitHub Pages workflow

To redirect GitHub Pages to Vercel:
```html
<!-- Add to web/index.html for GitHub Pages -->
<meta http-equiv="refresh" content="0; url=https://overstand.tools">
```

## Next Steps

After setup is complete:

1. ✅ Create a test PR to verify preview deployments
2. ✅ Check cache versioning in browser DevTools
3. ✅ Test update notification in production
4. ✅ Monitor Vercel analytics dashboard
5. ✅ Set up custom domain (optional)

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- This Project Issues: https://github.com/pzfreo/overstand/issues

## Rollback Plan

If you need to rollback to GitHub Pages:

1. Re-enable deploy job in `.github/workflows/test-and-deploy.yml`
2. Disconnect Vercel integration in GitHub settings
3. Push to main to trigger GitHub Pages deployment
4. Service worker changes are compatible with both platforms

---

**Ready to deploy?** Follow the steps above and you'll have automatic previews in ~15 minutes! 🚀

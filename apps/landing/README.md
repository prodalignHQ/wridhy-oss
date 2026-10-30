# Wridhy Landing Page (Static)

Dedicated static marketing page for **Wridhy**. Built with **Next.js 16** (App Router) using **Static HTML Export** (`output: 'export'`) and styled with **Tailwind CSS v4**.

---

## 🚀 Features

- **100% Static HTML/CSS/JS export**: Zero server runtime needed (`out/` directory generated on build).
- **Direct GitHub Integration**: All CTAs seamlessly redirect visitors to your GitHub repository.
- **Dark/Light Mode**: Smooth client-side theme switching synced via localStorage.
- **Configurable GitHub URL**: Set `NEXT_PUBLIC_GITHUB_URL` to point to your repository (defaults to `https://github.com/prodalignHQ/nuffmoney`).
- **Ultra-fast & SEO-optimized**: Built-in meta tags and font optimization.

---

## 🛠️ Local Development

From repository root:
```bash
# Start landing page dev server (runs on port 3002)
pnpm --filter @momoney/landing dev
```

Or from inside `apps/landing`:
```bash
pnpm dev
```
Open [http://localhost:3002](http://localhost:3002) in your browser.

---

## 📦 Building for Production

```bash
# Build & export static files to apps/landing/out
pnpm --filter @momoney/landing build
```

This generates pure static files inside `apps/landing/out/` ready to be served by any static web server or CDN.

---

## 🚢 Deploying to Vercel

### Option 1: Via Vercel Web Dashboard (Recommended for Monorepos)

1. Go to [vercel.com](https://vercel.com) and click **"Add New..." → "Project"**.
2. Select your `nuffmoney` (or `momoney-oss`) GitHub repository.
3. In the project configuration screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select `apps/landing`
4. Expand **Environment Variables** (optional):
   - Add `NEXT_PUBLIC_GITHUB_URL`: Your custom GitHub repository URL (defaults to `https://github.com/prodalignHQ/nuffmoney`).
5. Click **Deploy**. Vercel will build and deploy the landing page to its global CDN.

---

### Option 2: Deploying via Vercel CLI

From the `apps/landing` directory:
```bash
cd apps/landing
npx vercel
```
When prompted:
- Set up and deploy: **Yes**
- Link to existing project: **No** (or choose your project)
- Project name: `wridhy-landing`
- Directory located: `./`
- In build settings: framework will auto-detect as Next.js.
- For production deployment: `npx vercel --prod`

---

## 🌐 Deploying to Other Platforms

### Cloudflare Pages
- **Build command**: `pnpm --filter @momoney/landing build`
- **Build output directory**: `apps/landing/out`
- **Root directory**: `/` (or `apps/landing`)

### Netlify
- **Base directory**: `apps/landing`
- **Build command**: `pnpm run build`
- **Publish directory**: `apps/landing/out`

### GitHub Pages / S3 / Static Web Server
Simply upload the contents of the `apps/landing/out/` directory.

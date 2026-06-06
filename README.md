# CoffeeOS 2.0

Roastery management system built on React + Supabase + Netlify.

## Setup

### 1. Run the Supabase schema
Copy the contents of `SCHEMA.sql` and paste into your Supabase project's **SQL Editor**, then click **Run**.

This creates:
- `roasts` table
- `greens` table  
- `settings` table (with your global cost defaults)
- `hero-images` storage bucket
- Row Level Security policies

### 2. Install dependencies
```bash
npm install
```

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:5173

### 4. Build for production
```bash
npm run build
```
This creates a `dist/` folder.

### 5. Deploy to Netlify
1. Go to https://app.netlify.com/drop
2. Drag and drop the `dist/` folder
3. Done — your app is live

Or connect your GitHub repo to Netlify for automatic deploys on every push.

## Stack
- **React 18** + Vite
- **Supabase** — database, storage, auto API
- **React Router** — SPA routing + public cert URLs
- **Recharts** — dashboard charts
- **qrcode.react** — QR codes on certificates

## Features
- Dashboard with output & stock charts
- Roast batch management (full CRUD)
- Green inventory with stock tracking & low-stock alerts
- Full costing: production costs, per-bag pricing, wholesale/retail/VAT
- Premium batch certificates with PDF print
- Shareable public certificate URLs (`/cert/:id`)
- QR codes on certificates
- Hero image upload to Supabase Storage (real URLs, no base64)
- Global settings for gas, electricity, labour, packaging, markup rates

# Setup Guide

## 1 — Install Node.js (one-time)

Download from https://nodejs.org (LTS version). After installing, close and reopen Terminal.

## 2 — Install dependencies

Open Terminal, paste this and press Enter:

```
cd "/Users/victoriafung/Desktop/invoice coding/coupa-status-app"
```

Then:

```
npm install
```

Wait about 1–2 minutes for it to finish.

## 3 — Set up your credentials file

Your `.env.local` file only needs three lines:

```
COUPA_INSTANCE_URL=https://yourcompany.coupahost.com
COUPA_CLIENT_ID=your_client_id_here
COUPA_CLIENT_SECRET=your_client_secret_here
```

You already have the Client ID and Secret from Coupa. Just make sure the Instance URL matches your real Coupa URL.

## 4 — Run locally to test

```
npm run dev
```

Open your browser and go to: **http://localhost:3000**

## 5 — Deploy to Vercel (share with your team)

1. Go to vercel.com, create a free account
2. Install the Vercel CLI: `npm install -g vercel`
3. In Terminal (inside the coupa-status-app folder): `vercel`
4. Follow the prompts — it will give you a public URL
5. Add your environment variables in Vercel:
   - Go to your project on vercel.com → Settings → Environment Variables
   - Add COUPA_INSTANCE_URL, COUPA_CLIENT_ID, COUPA_CLIENT_SECRET
6. Redeploy: `vercel --prod`

Share the Vercel URL with your team. No login required — they just open it and search.

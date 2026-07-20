# everee health

Personal wellness management app for managing MdDS, dysautonomia, MCAS, VOR dysfunction, and the July-December 2026 wellness plan.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create environment file
```bash
cp .env.example .env
```
Fill in your Supabase anon key in `.env`.

### 3. Set up Supabase database
Go to your Supabase project at https://jdxtlxpvimjvcfrmeeap.supabase.co
Open the SQL editor and run the contents of `supabase_schema.sql`.

### 4. Configure GitHub Pages
In the GitHub repo settings, enable Pages pointing to the `gh-pages` branch (created by `npm run deploy`).

Update the `homepage` field in `package.json` to match your actual GitHub Pages URL once Pages is enabled.

### 5. Add OAuth redirect URI
In Google Cloud Console > APIs & Services > Credentials, add your GitHub Pages URL to the OAuth client's Authorized Redirect URIs.

### 6. Run locally
```bash
npm start
```

### 7. Deploy
```bash
npm run deploy
```

## Architecture

- **Frontend**: React, hosted on GitHub Pages
- **Backend**: Supabase (PostgreSQL)
- **Health data**: Google Health API v4 (Fitbit sync)
- **Design**: Dark mode, Fraunces serif + Inter Tight + JetBrains Mono

## Five tabs

1. **Today** -- Symptom scores, cycle tracking, 53-task checklist, daily wins, notes
2. **Episodes** -- Unified episode log (MCAS, pre-BM, cardiac, vestibular, gut, esophageal, anxiety)
3. **Heart** -- Solo mode (colour signal only, no numbers), Rylie mode (PIN, full data), solo episode protocol
4. **Food** -- Food diary per meal, calorie tracking (1500 min / 1800 goal), no-go trigger list
5. **More** -- Wellness plan (phase-aware), symptom trends, medication list

## Important: Rylie PIN
The default PIN in `Heart.js` is `1234`. Change this before sharing the app. Eventually this will be settable from the Settings screen.

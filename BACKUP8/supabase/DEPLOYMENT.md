# EDGE FUNCTION DEPLOYMENT GUIDE

## Prerequisites
1. Install Supabase CLI: `npm install -g supabase`
2. Login to Supabase: `supabase login`
3. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`

## Folder Structure
```
supabase/
└── functions/
    ├── _shared/
    │   └── cors.ts
    └── calculate-project/
        ├── index.ts          # Main handler
        ├── electrical.ts     # Electrical engine
        ├── hvac.ts          # HVAC engine
        └── types.ts         # TypeScript interfaces
```

## Deployment Steps

### 1. Deploy the Function
```bash
cd /path/to/your/project
supabase functions deploy calculate-project
```

### 2. Set Environment Variables (if needed)
```bash
supabase secrets set MY_SECRET_KEY=value
```

### 3. Test Locally (Optional)
```bash
supabase functions serve calculate-project
```

Then test with:
```bash
curl -X POST http://localhost:54321/functions/v1/calculate-project \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "electrical",
    "inputs": [
      {
        "type": "Socket 插座",
        "phase": "1",
        "qty": 5,
        "power": 1000,
        "unit": "W",
        "length": 15
      }
    ]
  }'
```

## Production URL
After deployment, your function will be available at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/calculate-project
```

## Security Notes
✅ All calculation formulas are protected server-side
✅ No sensitive constants exposed to client
✅ CORS headers configured (update in production)
✅ Type-safe with TypeScript

## Next Steps
- Proceed to Phase 3: Stripe Webhook
- Update frontend to call this Edge Function

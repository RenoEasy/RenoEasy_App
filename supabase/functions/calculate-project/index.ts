// supabase/functions/calculate-project/index.ts

// [重要] 移除舊版 URL import，解決 VS Code 紅線報錯
// import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { calculateElectrical } from './electrical.ts';
import { calculateHVAC } from './hvac.ts';

// Path: supabase/functions/calculate-project/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // ✅ [完美版] 包含 prefer, accept-profile, content-profile 等所有 Supabase 常用標頭
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, accept-profile, content-profile, prefer',
};

// 使用 Deno 內建的 serve 函數 (無需引用外部網址)
Deno.serve(async (req: Request) => {
  // 1. CORS 預檢
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. 接收數據
    const body = await req.json();
    
    // 3. 路由判斷 (Router Logic)
    let result;

    if (body.action === 'hvac') {
        // --- 執行 HVAC 計算 ---
        console.log("Processing HVAC Request...");
        
        // 防呆: 確保 inputs 是陣列
        const hvacInputs = body.inputs || [];
        if (!Array.isArray(hvacInputs)) {
            throw new Error("Invalid inputs: HVAC 數據必須是陣列");
        }
        result = calculateHVAC(hvacInputs);

    } else {
        // --- 執行 電力計算 (預設) ---
        console.log("Processing Electrical Request...");
        
        // 兼容舊版結構
        // --- 執行 電力計算 (預設) ---
        console.log("Processing Electrical Request...");
        
        // [修正] 加了 || []，如果沒數據就當作是「空列表」，不要報錯
        const elecInputs = body.inputs || body.items || [];
        
        // 只有當它真的「格式錯誤」(例如傳了字串) 才報錯
        if (!Array.isArray(elecInputs)) {
            throw new Error("Invalid inputs: 電力數據必須是陣列");
        }
        result = calculateElectrical(elecInputs);
    }

    // 4. 回傳結果
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
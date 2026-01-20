// supabase/functions/calculate-project/index.ts

// [重要] 移除舊版 URL import，解決 VS Code 紅線報錯
// import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import { calculateElectrical } from './electrical.ts';
import { calculateHVAC } from './hvac.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
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
        const elecInputs = body.inputs || body.items;
        
        if (!elecInputs || !Array.isArray(elecInputs)) {
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
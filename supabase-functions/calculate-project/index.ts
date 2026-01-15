// supabase/functions/calculate-project/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// 確保這裡引用的檔名與你資料夾內的檔名一致 (electrical.ts)
import { calculateElectrical } from './electrical.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. 處理跨域請求 (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. 獲取數據
    const body = await req.json();
    
    // 兼容處理：無論前端傳 { inputs: [...] } 還是 { items: [...] }
    const inputs = body.inputs || body.items;

    if (!inputs || !Array.isArray(inputs)) {
       throw new Error("無效的輸入數據 (Invalid inputs): 必須是陣列");
    }

    console.log(`⚡ 收到電力計算請求，項目數: ${inputs.length}`);

    // 3. 調用 electrical.ts 進行計算
    const result = calculateElectrical(inputs);

    // 4. 回傳成功結果
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // 5. 錯誤處理 (修正了語法，移除了 :any 以避免打包錯誤)
    console.error('Calculation Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
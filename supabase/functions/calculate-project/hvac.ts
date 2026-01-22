// ============================================================================
// HVAC CALCULATION ENGINE - Supabase Edge Function
// ============================================================================
// Version: 2.0 (Premium)
// Implementation:
// 1. Fixed Design Criteria (V2.0 Standard: Wall 20%, West, Cp 1.025)
// 2. 24H Climate Data (Macau)
// 3. Exact Layout Mapping for PDF Report
// 4. Enthalpy Precision: 2 decimal places (Display)
// ============================================================================

import type { HVACInput, HVACResult, DetailedLoad } from './types.ts';

// ============================================================================
// 1. 房間經驗值數據庫 (ROOM DEFAULTS - V2.0)
// ============================================================================

interface RoomDefaults {
  label: string;
  window_ratio: number;
  wall_ratio: number;        // Fixed to 0.20
  orientation: 'north' | 'east' | 'south' | 'west';
  has_roof: boolean;
  u_wall: number;
  u_glass: number;
  sc_glass: number;
  reqFA: boolean;
  reqEA: boolean;
  target_ach?: number;       // 自定義換氣次數
  is_transfer_air?: boolean; // 是否為借風空間
  transfer_ratio?: number;   // 借風率 (0.0~1.0)，例如 0.7 代表 70% 風量來自鄰室

  std_occ_density: number;   // m²/person
  std_light_density: number; // W/m²
  std_equip_density: number; // W/m²
}

const GLOBAL_WALL_RATIO = 0.20;
const GLOBAL_ORIENTATION = 'west';

const ROOM_DEFAULTS: Record<string, RoomDefaults> = {
  "office": {
    label: "Office (辦公室)",
    window_ratio: 0.12, wall_ratio: GLOBAL_WALL_RATIO, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: false,
    std_occ_density: 5, std_light_density: 15, std_equip_density: 25
  },
  "meeting": {
    label: "Meeting Room (會議室)",
    window_ratio: 0.15, wall_ratio: GLOBAL_WALL_RATIO, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: false,
    std_occ_density: 3, std_light_density: 15, std_equip_density: 25
  },
  "pantry": {
    label: "Pantry (茶水間)",
    window_ratio: 0.08, wall_ratio: GLOBAL_WALL_RATIO, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: false, reqEA: true,
    
    // [修改] 6 ACH, 100% 借風 (顯熱負荷=0)
    target_ach: 6,
    is_transfer_air: true,
    transfer_ratio: 1.0,
    
    std_occ_density: 5, std_light_density: 15, std_equip_density: 50
  },
  "server": {
    label: "Server Room (機房)",
    window_ratio: 0.00, wall_ratio: 0.25, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: false, reqEA: false,
    std_occ_density: 10, std_light_density: 15, std_equip_density: 150
  },
  "retail": {
    label: "Retail Store (零售店)",
    window_ratio: 0.20, wall_ratio: 0.30, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: false,
    std_occ_density: 4, std_light_density: 20, std_equip_density: 20
  },
  "pharmacy": {
    label: "Pharmacy (藥房)",
    window_ratio: 0.10, wall_ratio: 0.25, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: false,
    std_occ_density: 5, std_light_density: 20, std_equip_density: 20
  },
  "dining": {
    label: "Dining Area (餐廳用餐區)",
    window_ratio: 0.18, wall_ratio: 0.25, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: false,
    std_occ_density: 2, std_light_density: 15, std_equip_density: 10
  },
  "kitchen": {
    label: "Kitchen (廚房)",
    window_ratio: 0.05, wall_ratio: 0.25, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: false, reqEA: true,
    
    // [修改] 30 ACH, 70% 借風 (只需冷卻 30% 的補風)
    target_ach: 30,
    is_transfer_air: true,
    transfer_ratio: 0.7, 
    
    std_occ_density: 10, std_light_density: 15, std_equip_density: 100
  },
  "classroom": {
    label: "Classroom (補習社)",
    window_ratio: 0.15, wall_ratio: GLOBAL_WALL_RATIO, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: false,
    std_occ_density: 3, std_light_density: 15, std_equip_density: 15
  },
  "clinic": {
    label: "Clinic (診所)",
    window_ratio: 0.12, wall_ratio: GLOBAL_WALL_RATIO, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: false,
    std_occ_density: 5, std_light_density: 15, std_equip_density: 25
  },
  "beauty": {
    label: "Beauty Salon (美容院)",
    window_ratio: 0.10, wall_ratio: GLOBAL_WALL_RATIO, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: true,
    std_occ_density: 5, std_light_density: 15, std_equip_density: 30
  },
  "gym": {
    label: "Gym / Yoga (健身室)",
    window_ratio: 0.10, wall_ratio: 0.25, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: true, reqEA: true,
    std_occ_density: 4, std_light_density: 15, std_equip_density: 20
  },
  "toilet": {
    label: "Toilet (廁所)",
    window_ratio: 0.05, wall_ratio: GLOBAL_WALL_RATIO, orientation: GLOBAL_ORIENTATION, has_roof: false,
    u_wall: 2.0, u_glass: 5.6, sc_glass: 0.6, reqFA: false, reqEA: true,
    
    // [修改] 10 ACH, 100% 借風
    target_ach: 10,
    is_transfer_air: true,
    transfer_ratio: 1.0,
    
    std_occ_density: 0, std_light_density: 10, std_equip_density: 0
  }
};

// ============================================================================
// 2. 氣象數據庫 (CLIMATE DATA)
// ============================================================================
// 24-hour hourly data for Macau Design Conditions
// Peak Hour Selected: 16:00 (Index 15)
// ============================================================================

const CLIMATE_DATA = {
  // Outdoor Dry Bulb Temperature (°C)
  outdoor_temp_db: [28, 27.5, 27.2, 27, 27, 27.5, 28.5, 29.8, 31, 32, 32.8, 33.4, 33.8, 34, 34, 33.6, 33, 32, 31, 30.2, 29.5, 29, 28.5, 28.2],

  // Outdoor Enthalpy (kJ/kg) - Hourly
  outdoor_enthalpy: [83.34, 81.17, 79.90, 79.06, 79.06, 81.17, 82.28, 84.44, 85.93, 86.28, 89.70, 92.34, 94.14, 95.05, 95.05, 93.24, 90.58, 86.28, 85.93, 86.17, 86.63, 84.43, 82.28, 81.01],

  // CLTD - Wall (K)
  cltd_wall: {
    north: [8, 7, 6, 5, 4, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13, 13, 12, 11, 10, 10, 9, 9],
    east: [10, 9, 8, 7, 6, 6, 7, 10, 14, 18, 20, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 12, 11, 11],
    south: [9, 8, 7, 6, 5, 5, 5, 4, 4, 5, 7, 10, 13, 16, 19, 21, 22, 21, 19, 17, 15, 13, 11, 10],
    west: [18, 16, 14, 12, 10, 9, 8, 7, 6, 6, 6, 7, 9, 12, 16, 20, 24, 26, 27, 26, 24, 22, 20, 19]
  },

  // CLTD - Roof (Heavy) (K)
  cltd_roof: [18, 16, 14, 12, 10, 8, 6, 6, 8, 12, 16, 20, 24, 27, 29, 30, 30, 29, 27, 25, 23, 21, 20, 19],

  // CLTD - Glass Conduction (K)
  cltd_glass: [4, 3.5, 3.2, 3, 3, 3.5, 4.5, 5.8, 7, 8, 8.8, 9.4, 9.8, 10, 10, 9.6, 9, 8, 7, 6.2, 5.5, 5, 4.5, 4.2],

  // Solar Cooling Load (SCL) - Glass (W/m²)
  scl_glass: {
    north: [0, 0, 0, 0, 0, 20, 50, 70, 85, 95, 100, 100, 100, 100, 95, 85, 70, 40, 10, 0, 0, 0, 0, 0],
    east: [0, 0, 0, 0, 0, 150, 450, 650, 720, 600, 400, 220, 120, 80, 60, 50, 40, 20, 10, 0, 0, 0, 0, 0],
    south: [0, 0, 0, 0, 0, 10, 20, 30, 50, 80, 110, 130, 130, 110, 80, 50, 30, 10, 0, 0, 0, 0, 0, 0],
    west: [0, 0, 0, 0, 0, 10, 20, 30, 40, 50, 60, 70, 150, 350, 550, 680, 700, 500, 200, 10, 0, 0, 0, 0]
  }
};

// ============================================================================
// 3. 核心計算函數
// ============================================================================

function calculateSpace(input: HVACInput): HVACResult | null {
  try {
    // ------------------------------------------------------------------------
    // A. Constants & Config
    // ------------------------------------------------------------------------
    const CP_AIR = 1.025; 
    const INDOOR_TEMP = 22;
    const INDOOR_ENTHALPY = 45.15;
    const OUTDOOR_ENTHALPY_MAX = 95.05;

    // ------------------------------------------------------------------------
    // B. Data Validation
    // ------------------------------------------------------------------------
    const defaults = ROOM_DEFAULTS[input.key];
    if (!defaults) {
      console.error(`[HVAC] Invalid space type: ${input.key}`);
      return null;
    }

    const area = parseFloat(String(input.area)) || 0;
    const height = parseFloat(String(input.height ?? 3.0)) || 3.0;
    const people = parseFloat(String(input.people ?? 0)) || 0;

    if (area <= 0) return null;

    // ------------------------------------------------------------------------
    // C. Geometry Estimation
    // ------------------------------------------------------------------------
    const window_area = area * defaults.window_ratio;
    const wall_area = area * defaults.wall_ratio;
    const roof_area = defaults.has_roof ? area : 0;
    const volume = area * height;

    // ------------------------------------------------------------------------
    // D. Peak Hour Condition (16:00, Index 15)
    // ------------------------------------------------------------------------
    const PEAK_HOUR = 15;
    
    // Hourly data for calculation
    const peak_temp = CLIMATE_DATA.outdoor_temp_db[PEAK_HOUR];
    const peak_enthalpy_calc = CLIMATE_DATA.outdoor_enthalpy[PEAK_HOUR];
    const wb_temp = 28.2; 

    // CLTD/SCL Params
    const cltd_wall = CLIMATE_DATA.cltd_wall[defaults.orientation][PEAK_HOUR];
    const cltd_roof = CLIMATE_DATA.cltd_roof[PEAK_HOUR];
    const cltd_glass = CLIMATE_DATA.cltd_glass[PEAK_HOUR];
    const scl_glass = CLIMATE_DATA.scl_glass[defaults.orientation][PEAK_HOUR];

    // ------------------------------------------------------------------------
    // E. Load Calculation
    // ------------------------------------------------------------------------

    // 1. Envelope
    const Q_wall = defaults.u_wall * wall_area * cltd_wall;
    const Q_roof = defaults.has_roof ? (0.5 * roof_area * cltd_roof) : 0;
    const Q_glass_conduction = defaults.u_glass * window_area * cltd_glass;
    const Q_glass_radiation = window_area * defaults.sc_glass * scl_glass;
    const Q_envelope_total = Q_wall + Q_roof + Q_glass_conduction + Q_glass_radiation;

    // 2. People
    const people_sensible = people * 75;
    const people_latent = people * 60;
    const Q_people = people_sensible + people_latent;

    // 3. Lighting
    const Q_lighting = area * defaults.std_light_density;

    // 4. Equipment
    const Q_equipment = area * defaults.std_equip_density;

    // ------------------------------------------------------------------------
    // [CRITICAL UPDATE v2.3] 5. Fresh Air & Infiltration (Hybrid Ratio Logic)
    // ------------------------------------------------------------------------
    
    // 5.1 參數獲取
    // [修改] 優先讀取自定義 target_ach，若無則預設 10 (僅當 reqEA=true)
    const defaultACH = (defaults.reqEA) ? (defaults.target_ach || 10) : 0;
    
    const fresh_air_rate = 10; 
    const inputReqFA = (input as any).reqFA;
    const requiresFreshAir = inputReqFA !== undefined ? inputReqFA : defaults.reqFA;
    const fa_people_ls = requiresFreshAir ? (people * fresh_air_rate) : 0;

    // 5.2 排風量計算
    const inputReqEA = (input as any).reqEA;
    const requiresExhaust = inputReqEA !== undefined ? inputReqEA : defaults.reqEA;
    // [修改] 使用新的 defaultACH (Kitchen=30, Pantry=6, Toilet=10)
    const ach = requiresExhaust ? defaultACH : 0;
    const exhaust_ls = (volume * ach) / 3.6; 

    // 5.3 質量守恆檢查 (Mass Balance Check)
    // 計算物理上必須進入房間的空氣總量
    const effective_fa_ls = Math.max(fa_people_ls, exhaust_ls);
    const m_fresh_air = effective_fa_ls * 1.2 / 1000; // kg/s

    // [核心修改] 借風率計算 (Hybrid Transfer Air)
    // 邏輯：sensible_load_factor 代表「需要由冷氣機處理的室外空氣比例」
    // Kitchen: ratio 0.7 (70%借風) -> factor 0.3 (30%室外風需冷卻)
    // Pantry:  ratio 1.0 (100%借風) -> factor 0.0 (0%室外風需冷卻)
    
    let sensible_load_factor = 1.0; // 預設 100% 室外風

    if (defaults.is_transfer_air && !requiresFreshAir) {
        // 如果定義了 transfer_ratio，則使用定義值；否則預設為 1.0 (全借風)
        const ratio = defaults.transfer_ratio !== undefined ? defaults.transfer_ratio : 1.0;
        sensible_load_factor = 1.0 - ratio; 
        
        // 防呆：確保不小於 0
        if (sensible_load_factor < 0) sensible_load_factor = 0;
    }

    // Sensible Calculation
    const Q_fa_sensible = m_fresh_air * CP_AIR * (peak_temp - INDOOR_TEMP) * 1000 * sensible_load_factor;

    // Latent & Total Calculation
    const Q_fa_total_raw = m_fresh_air * (peak_enthalpy_calc - INDOOR_ENTHALPY) * 1000;
    const Q_fa_sensible_raw = m_fresh_air * CP_AIR * (peak_temp - INDOOR_TEMP) * 1000;
    const Q_fa_latent_raw = Q_fa_total_raw - Q_fa_sensible_raw;
    
    // [修正] 借風不僅借溫度，也借濕度。潛熱同樣只需處理室外引入的那 30%
    const Q_fa_latent = Q_fa_latent_raw * sensible_load_factor; 
    
    const Q_fa_total = Q_fa_sensible + Q_fa_latent;

    // ------------------------------------------------------------------------
    // F. Summaries
    // ------------------------------------------------------------------------
    const sub_total_sensible = Q_envelope_total + people_sensible + Q_lighting + Q_equipment;
    const sub_total_latent = people_latent;
    const sub_total = sub_total_sensible + sub_total_latent;

    const grand_total_sensible = sub_total_sensible + Q_fa_sensible;
    const grand_total_latent = sub_total_latent + Q_fa_latent;
    const grand_total = grand_total_sensible + grand_total_latent;

    // ------------------------------------------------------------------------
    // G. Equipment Sizing
    // ------------------------------------------------------------------------
    const safety_factor = 1.1; // 10%
    const required_cooling_kw = (grand_total * safety_factor) / 1000;
    const required_cooling_hp = required_cooling_kw / 2.5;
    const rounded_hp = Math.ceil(required_cooling_hp * 2) / 2;

    // 報告顯示用的數值 (L/s -> CMH)
    // effective_fa_ls 包含了滲透風，這是冷氣機實際要處理的風量
    const required_fa_cmh = effective_fa_ls * 3.6; 
    const required_ea_cmh = exhaust_ls * 3.6;

    // ------------------------------------------------------------------------
    // H. Result Construction (DetailedLoad)
    // ------------------------------------------------------------------------
    const detailedLoad: DetailedLoad = {
      design_params: {
        outdoor_temp_db: peak_temp,
        outdoor_temp_wb: wb_temp,
        outdoor_enthalpy: OUTDOOR_ENTHALPY_MAX,
        winter_temp: 7.0,
        indoor_temp: INDOOR_TEMP,
        indoor_rh: 55,
        indoor_enthalpy: INDOOR_ENTHALPY,
        fresh_air_rate: requiresFreshAir ? fresh_air_rate : 0, 
        // [修正] 動態顯示實際使用的 ACH (Kitchen=30, Pantry=6)
        exhaust_air_rate: requiresExhaust ? `${ach} ACH` : "N/A",
        occupancy_density: defaults.std_occ_density,
        lighting_density: defaults.std_light_density,
        equipment_density: defaults.std_equip_density
      },
      load_summary: {
        peak_hour: PEAK_HOUR + 1, 
        glass_radiation: {
          sensible: Math.round(Q_glass_radiation), latent: 0, total: Math.round(Q_glass_radiation)
        },
        glass_conduction: {
          sensible: Math.round(Q_glass_conduction), latent: 0, total: Math.round(Q_glass_conduction)
        },
        wall_roof: {
          sensible: Math.round(Q_wall + Q_roof), latent: 0, total: Math.round(Q_wall + Q_roof)
        },
        people: {
          sensible: Math.round(people_sensible),
          latent: Math.round(people_latent),
          total: Math.round(Q_people)
        },
        lighting: {
          sensible: Math.round(Q_lighting), latent: 0, total: Math.round(Q_lighting)
        },
        equipment: {
          sensible: Math.round(Q_equipment), latent: 0, total: Math.round(Q_equipment)
        },
        fresh_air: {
          sensible: Math.round(Q_fa_sensible),
          latent: Math.round(Q_fa_latent),
          total: Math.round(Q_fa_total)
        },
        subtotal: {
          sensible: Math.round(sub_total_sensible),
          latent: Math.round(sub_total_latent),
          total: Math.round(sub_total)
        },
        grand_total: {
          sensible: Math.round(grand_total_sensible),
          latent: Math.round(grand_total_latent),
          total: Math.round(grand_total)
        }
      },
      equipment_sizing: {
        cooling: {
          grand_total_w: Math.round(grand_total),
          safety_factor: 10,
          required_kw: parseFloat(required_cooling_kw.toFixed(2)),
          required_hp: parseFloat(required_cooling_hp.toFixed(2)),
          rounded_hp: rounded_hp
        },
        fresh_air: {
            number_of_people: people,
            // [修正] 同步修正這裡，讓前端 Section 3 也能隱藏
            fresh_air_rate: requiresFreshAir ? fresh_air_rate : 0,
            required_ls: Math.round(effective_fa_ls),
            required_cmh: Math.round(effective_fa_ls * 3.6)
        },
        airflow: {
          room_sensible_w: Math.round(sub_total_sensible),
          supply_air_dt: 10,
          air_density_cp: 1.224,
          required_ls: Math.round(effective_fa_ls),
          required_cmh: Math.round(required_fa_cmh)
        },
        exhaust: {
          volume_m3: parseFloat(volume.toFixed(2)),
          ach: ach,
          required_cmh: Math.round(required_ea_cmh)
        }
      },
      geometry: {
        window_area: parseFloat(window_area.toFixed(2)),
        wall_area: parseFloat(wall_area.toFixed(2)),
        roof_area: parseFloat(roof_area.toFixed(2)),
        volume: parseFloat(volume.toFixed(2)),
        orientation: defaults.orientation
      }
    };

    return {
      id: Date.now(),
      key: input.key,
      label: defaults.label,
      area: area,
      height: height,
      people: people,
      coolingHP: rounded_hp,
      coolingHPDisplay: rounded_hp > 0 ? `${rounded_hp} HP` : "-",
      requiresFreshAir: requiresFreshAir,
      requiresExhaust: requiresExhaust,
      freshAirDisplay: requiresFreshAir ? "YES / 是" : "NO / 否",
      exhaustDisplay: requiresExhaust ? "YES / 是" : "NO / 否",
      detailedLoad: detailedLoad
    };

  } catch (error) {
    console.error('[HVAC] Calculation error:', error);
    return null;
  }
}

// ============================================================================
// Public API
// ============================================================================

export function calculateHVAC(inputs: HVACInput[]): HVACResult[] {
  const results: HVACResult[] = [];
  for (const input of inputs) {
    const result = calculateSpace(input);
    if (result) results.push(result);
  }
  return results;
}

export function getSpaceTypes(): Array<{ key: string; label: string }> {
  return Object.entries(ROOM_DEFAULTS).map(([key, def]) => ({
    key,
    label: def.label
  }));
}

export function isValidSpaceType(key: string): boolean {
  return key in ROOM_DEFAULTS;
}
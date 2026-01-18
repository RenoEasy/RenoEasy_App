// ============================================================================
// TYPE DEFINITIONS - RenoEasy Edge Function
// ============================================================================

// ----------------------------------------------------------------------------
// Common Types
// ----------------------------------------------------------------------------
export type Phase = '1' | '3';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ----------------------------------------------------------------------------
// ELECTRICAL Types
// ----------------------------------------------------------------------------
export interface ElectricalInput {
  type: string;
  phase: Phase;
  qty: number;
  power: number;
  unit: string;
  length: number;
}

export interface ElectricalCircuit {
  circuitNo: string;
  name: string;
  qty: number;
  power: number;
  unit: string;
  phase: Phase;
  length: number;
  df: number;
  originalType: string;
}

export interface CircuitResult {
  circuitNo: string;
  name: string;
  assignedPhase: string;
  breaker: number;
  protectionType: string;
  cable: string;
  vd: number;
  Pinst: number;
  df: number;
  Psim: number;
  is3Phase: boolean;
  singlePhaseIdx: number | null;
}

export interface PhaseBalance {
  L1: number;
  L2: number;
  L3: number;
}

export interface ElectricalResult {
  rows: CircuitResult[];
  totalKva: number;
  phaseBalance: PhaseBalance;
  mainSwitch: string;
  meter: string;
  serviceBreaker: string;
  meterKva: number;
}

// ----------------------------------------------------------------------------
// HVAC Types (V2.0 - Premium Report Structure)
// ----------------------------------------------------------------------------
export interface HVACInput {
  key: string;      // e.g., "office", "meeting"
  area: number;     // Square meters
  height?: number;  // Ceiling height (default: 3.0m)
  people?: number;  // Number of occupants (User responsibility)
}

// 詳細負荷數據結構 (對應 PDF/Excel 報告)
// 包含了生成報告所需的所有中間值與常數
export interface DetailedLoad {
  // 1. Design Parameters (設計參數表格)
  design_params: {
    outdoor_temp_db: number;      // e.g. 33.0
    outdoor_temp_wb: number;      // e.g. 28.2
    outdoor_enthalpy: number;     // e.g. 95.05 (Max)
    
    winter_temp: number;          // Fixed: 7.0
    
    indoor_temp: number;          // e.g. 22
    indoor_rh: number;            // e.g. 55
    indoor_enthalpy: number;      // e.g. 45.15
    
    fresh_air_rate: number;       // e.g. 10
    exhaust_air_rate: string;     // e.g. "10 ACH" or "N/A"
    occupancy_density: number;    // e.g. 5
    lighting_density: number;     // e.g. 15
    equipment_density: number;    // e.g. 25
  };

  // 2. Cooling Load Summary (負荷摘要表格)
  load_summary: {
    peak_hour: number;            // e.g. 16
    
    // 分項負荷 (包含顯熱/潛熱/總熱)
    glass_radiation:    { sensible: number; latent: number; total: number; };
    glass_conduction:   { sensible: number; latent: number; total: number; };
    wall_roof:          { sensible: number; latent: number; total: number; };
    people:             { sensible: number; latent: number; total: number; };
    lighting:           { sensible: number; latent: number; total: number; };
    equipment:          { sensible: number; latent: number; total: number; };
    fresh_air:          { sensible: number; latent: number; total: number; };
    
    // 匯總
    subtotal:           { sensible: number; latent: number; total: number; }; // Room Load
    grand_total:        { sensible: number; latent: number; total: number; }; // Peak Load
  };

  // 3. Equipment Sizing (設備選型表格)
  equipment_sizing: {
    cooling: {
      grand_total_w: number;
      safety_factor: number;      // 10 (display as 10%)
      required_kw: number;
      required_hp: number;
      rounded_hp: number;
    };
    airflow: {
      room_sensible_w: number;
      supply_air_dt: number;      // 10
      air_density_cp: number;     // 1.224 (approx) or calculated
      required_ls: number;
      required_cmh: number;
    };
    exhaust: {
      volume_m3: number;
      ach: number;
      required_cmh: number;
    };
  };

  // 4. Geometry (用於調試與驗證)
  geometry: {
    window_area: number;
    wall_area: number;
    roof_area: number;
    volume: number;
    orientation: string;
  };
}

export interface HVACResult {
  // ========== 免費項 (Free Tier) ==========
  id: number;
  key: string;
  label: string;
  area: number;
  height: number;
  people: number;
  coolingHP: number;
  coolingHPDisplay: string;
  requiresFreshAir: boolean;
  requiresExhaust: boolean;
  freshAirDisplay: string;
  exhaustDisplay: string;

  // ========== 收費項 (Premium Tier) ==========
  // 只有當後端計算成功並驗證通過時才返回此物件
  detailedLoad?: DetailedLoad;
}

// ----------------------------------------------------------------------------
// Request/Response Types
// ----------------------------------------------------------------------------
export interface CalculateElectricalRequest {
  action: 'electrical';
  inputs: ElectricalInput[];
}

export interface CalculateHVACRequest {
  action: 'hvac';
  inputs: HVACInput[];
}

export type CalculateRequest = CalculateElectricalRequest | CalculateHVACRequest;

export interface CalculateElectricalResponse extends ApiResponse {
  data: ElectricalResult;
}

export interface CalculateHVACResponse extends ApiResponse {
  data: HVACResult[];
}
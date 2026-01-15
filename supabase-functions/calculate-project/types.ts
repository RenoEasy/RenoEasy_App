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
  type: string;        // e.g., "Socket 插座", "Split-type AC 分體式空調"
  phase: Phase;        // '1' or '3'
  qty: number;         // Quantity
  power: number;       // Power rating
  unit: string;        // 'W', 'kW', 'HP', '匹'
  length: number;      // Cable length in meters
}

export interface ElectricalCircuit {
  circuitNo: string;
  name: string;
  qty: number;
  power: number;
  unit: string;
  phase: Phase;
  length: number;
  df: number;           // Diversity factor
  originalType: string;
}

export interface CircuitResult {
  circuitNo: string;
  name: string;
  assignedPhase: string;  // 'L1', 'L2', 'L3', or 'Tx'
  breaker: number;
  protectionType: string;
  cable: string;          // e.g., "R3x2.5", "R5x6"
  vd: number;             // Voltage drop percentage
  Pinst: number;          // Installed power (kVA)
  df: number;             // Diversity factor
  Psim: number;           // Simultaneous demand (kVA)
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
// HVAC Types
// ----------------------------------------------------------------------------
export interface HVACInput {
  key: string;      // e.g., "office", "meeting", "pantry"
  area: number;     // Square meters
  height?: number;  // Ceiling height (default: 3.0m)
  people?: number;  // Number of occupants
}

export interface HVACResult {
  id: number;
  key: string;
  label: string;
  area: number;
  height: number;
  people: number;
  coolingHP: number;        // Cooling capacity in HP
  coolingHPDisplay: string; // Formatted display (e.g., "2.5 HP")
  requiresFreshAir: boolean;
  requiresExhaust: boolean;
  freshAirDisplay: string;
  exhaustDisplay: string;
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
  items: HVACInput[];
}

export type CalculateRequest = CalculateElectricalRequest | CalculateHVACRequest;

export interface CalculateElectricalResponse extends ApiResponse {
  data: ElectricalResult;
}

export interface CalculateHVACResponse extends ApiResponse {
  data: HVACResult[];
}

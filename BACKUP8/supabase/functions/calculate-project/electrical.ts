// electrical.ts - Electrical Load Calculation Engine for Supabase Edge Functions

// ============================================================
// Type Definitions (型別定義)
// ============================================================

interface RawInput {
  type: string;
  phase?: string;
  qty: number;
  power: number;
  unit: string;
  length: number;
}

interface Circuit {
  circuitNo: string;
  name: string;
  qty: number;
  power: number;
  unit: string;
  phase: string;
  length: number;
  df: number;
  originalType: string;
}

interface CircuitResult {
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

interface PhaseBalance {
  L1: number;
  L2: number;
  L3: number;
}

interface CEMData {
  meterKva: number;
  serviceBreaker: string;
  mainSwitch: string;
  meterDisplay: string;
}

interface CalculationResult {
  rows: CircuitResult[];
  totalKva: number;
  phaseBalance: PhaseBalance;
  mainSwitch: string;
  meter: string;
  serviceBreaker: string;
  meterKva: number;
}

interface SinglePhaseLoad {
  idx: number;
  Psim: number;
}

// ============================================================
// Constants (常數定義)
// ============================================================

const CONSTANTS = {
  POWER_FACTOR: 0.85,
  SAFETY_FACTOR: 1.1,
  VOLTAGE_1PH: 230,
  VOLTAGE_3PH: 400,
  SQRT3: 1.732,
  SPLIT_LIMITS: { SOCKET: 3, LIGHTING: 15, INDOOR: 8 },
  DF_VALUES: { SOCKET: 0.7, LIGHTING: 0.9, INDOOR: 0.8, DEFAULT: 1.0 },
  BREAKER_SIZES: [10, 16, 20, 32, 40, 63, 100],
  CABLE_SIZES: ["1.5", "2.5", "4", "6", "10", "16", "25", "35", "50", "70"],
  VD_LIMITS: { LIGHTING: 3.0, THREE_PHASE: 4.0, SINGLE_PHASE: 5.0 }
};

// ============================================================
// Helper Functions (輔助函數)
// ============================================================

function getName(type: string): string {
  if (type.includes('Split') || type.includes('分體')) return 'Split-type AC\n分體式空調';
  if (type.includes('Outdoor') || type.includes('室外')) return 'VRV Outdoor Unit\nVRV室外機';
  return type;
}

function getSplitLimit(type: string): number {
  // 1. 插座 (Socket) -> 3個一組
  if (type.includes('Socket') || type.includes('插座')) return CONSTANTS.SPLIT_LIMITS.SOCKET;
  
  // 2. 照明 (Lighting) -> 15個一組
  if (type.includes('Light') || type.includes('照明') || type.includes('招牌')) return CONSTANTS.SPLIT_LIMITS.LIGHTING;
  
  // 3. [例外] 浴室寶 (Thermo) -> 1個一組 (必須獨立)
  // 必須放在 Fan 檢查之前
  if (type.includes('Thermo') || type.includes('浴室寶')) return 1;

  // 4. 小風機/VRV室內機 -> 8個一組
  if (type.includes('Indoor') || type.includes('室內機') || type.includes('Fan') || type.includes('通風機')) {
    return CONSTANTS.SPLIT_LIMITS.INDOOR;
  }
  
  // 5. 其他大功率設備 (冷氣、廚房、熱水、充電樁) -> 強制 1 個一組
  return 1;
}

// [修改] MCB 選型邏輯：加入 20% 緩衝 (Buffer)
function getBreakerSize(ib: number, minSize: number): number {
  const BUFFER = 1.2; // 20% 安全餘量

  for (const size of CONSTANTS.BREAKER_SIZES) {
    // 只有當斷路器規格 >= 運行電流的 1.2 倍時才選用
    if (size >= (ib * BUFFER) && size >= minSize) return size;
  }
  return 100;
}

function getCableSize(mcb: number): string {
  if (mcb <= 20) return '2.5';
  if (mcb <= 32) return '6';
  if (mcb <= 40) return '10';
  if (mcb <= 63) return '16';
  return '25';
}

function getNextCableSize(currentSize: string): string {
  const idx = CONSTANTS.CABLE_SIZES.indexOf(currentSize);
  return idx >= 0 && idx < CONSTANTS.CABLE_SIZES.length - 1 
    ? CONSTANTS.CABLE_SIZES[idx + 1] 
    : currentSize;
}

function calcVD(current: number, length: number, cableSize: string, is3Phase: boolean): number {
  const mvMap: Record<string, number> = { 
    '1.5': 29, '2.5': 18, '4': 11, '6': 7.3, '10': 4.4, '16': 2.8, '25': 1.75 
  };
  const mv = mvMap[cableSize] || 1.25;
  const voltage = is3Phase ? CONSTANTS.VOLTAGE_3PH : CONSTANTS.VOLTAGE_1PH;
  return ((mv * current * length) / 1000) / voltage * 100;
}

function getVDLimit(deviceType: string, is3Phase: boolean): number {
  if (deviceType.includes('Light')) return CONSTANTS.VD_LIMITS.LIGHTING;
  return is3Phase ? CONSTANTS.VD_LIMITS.THREE_PHASE : CONSTANTS.VD_LIMITS.SINGLE_PHASE;
}

function getProtectionType(deviceType: string): string {
  return 'RCD+MCB/RCBO\nType C';
}

// ============================================================
// Core Calculation Functions (核心計算函數)
// ============================================================

function preprocessInputs(rawInputs: RawInput[]): Circuit[] {
  const circuits: Circuit[] = [];
  let circuitNo = 1;

  const nameCounts: Record<string, number> = {};
  
  // 第一次循環：計算總迴路數以便編號
  rawInputs.forEach(input => {
    if (!input.qty || input.qty <= 0) return;
    const name = getName(input.type);
    const limit = getSplitLimit(input.type);
    const numCircuits = Math.ceil(input.qty / limit);
    nameCounts[name] = (nameCounts[name] || 0) + numCircuits;
  });
  
  const nameIndices: Record<string, number> = {};

  // 第二次循環：生成迴路
  rawInputs.forEach((input) => {
    const { type, phase, qty, power, unit, length } = input;
    
    if (!qty || qty <= 0) return;
    
    let deviceName = getName(type);
    let splitLimit = getSplitLimit(type);
    let df = CONSTANTS.DF_VALUES.DEFAULT;
    let finalPower = power;
    let finalUnit = unit;
    
    // 需差因數與功率修正
    // 1. [新增] 優先檢查廚房插座 (Kitchen Socket)
    // 必須放在普通 Socket 檢查之前！
    if (type.includes('Kitchen') || type.includes('廚房')) {
       df = 0.7; // 建議 DF (或 1.0)
       // 不修改 finalPower，保留用戶輸入的數值 (如 2000W)
       finalUnit = 'W';
    } 
    // 2. 普通插座 (General Socket)
    else if (type.includes('Socket') || type.includes('插座')) {
      df = CONSTANTS.DF_VALUES.SOCKET; // 0.7
      finalPower = 1000; // 普通插座鎖定 1000W
      finalUnit = 'W';
    
    } else if (type.includes('Light') || type.includes('照明')) {
      df = CONSTANTS.DF_VALUES.LIGHTING;
    } else if (type.includes('Indoor') || type.includes('風機')) {
      // 如果是浴室寶，不打折
      if (type.includes('Thermo') || type.includes('浴室寶')) {
        df = 1.0;
      } else {
        df = CONSTANTS.DF_VALUES.INDOOR;
        if (!finalPower) { finalPower = 200; finalUnit = 'W'; }
      }
    }
    
    // HP 轉換邏輯 (重要)
    if (finalUnit && (finalUnit.toUpperCase().includes('HP') || finalUnit.includes('匹'))) {
      finalPower = finalPower * 800; // 1 HP 約 800W
      finalUnit = 'W';
    }
    
    const cableLen = length > 0 ? length : 20;
    let remaining = qty;
    const needNumbering = (nameCounts[deviceName] > 1);
    
    while (remaining > 0) {
      const currentBatch = Math.min(remaining, splitLimit);
      
      if (!nameIndices[deviceName]) nameIndices[deviceName] = 0;
      nameIndices[deviceName]++;
      
      circuits.push({
        circuitNo: `C${circuitNo}`,
        name: needNumbering ? `${deviceName} #${nameIndices[deviceName]}` : deviceName,
        qty: currentBatch,
        power: finalPower,
        unit: finalUnit,
        phase: phase || '1', // 默認單相
        length: cableLen,
        df: df,
        originalType: type
      });
      
      remaining -= currentBatch;
      circuitNo++;
    }
  });
  
  return circuits;
}

function calculateCircuits(circuits: Circuit[]): {
  results: CircuitResult[];
  totalPsim: number;
  singlePhaseLoads: SinglePhaseLoad[];
} {
  const results: CircuitResult[] = [];
  let totalPsim = 0;
  const singlePhaseLoads: SinglePhaseLoad[] = [];
  
  circuits.forEach((circuit, idx) => {
    const { circuitNo, name, qty, power, unit, phase, length, df, originalType } = circuit;
    
    // ========================================================
    // 核心邏輯：信任用戶的相位輸入
    // ========================================================
    const is3Phase = (String(phase) === '3');
    
    let Pinst: number;
    // 插座計算 Pinst
    // 建議修改：明確排除廚房關鍵字
if (originalType.includes('Socket') && power === 1000 && !originalType.includes('Kitchen') && !originalType.includes('廚房')) {
      Pinst = (1000 / 1000) / CONSTANTS.POWER_FACTOR;
    } else {
      Pinst = (power * qty / 1000) / CONSTANTS.POWER_FACTOR;
    }
    
    const Psim = Pinst * df;
    totalPsim += Psim;
    
    let Ib: number;
    if (is3Phase) {
      // 三相計算公式 (sqrt3 * 400V)
      Ib = (Pinst * 1000 / (CONSTANTS.VOLTAGE_3PH * CONSTANTS.SQRT3)) * CONSTANTS.SAFETY_FACTOR;
    } else {
      // 單相計算公式 (230V) - 即使功率很大，只要用戶選單相，就照算
      Ib = (Pinst * 1000 / CONSTANTS.VOLTAGE_1PH) * CONSTANTS.SAFETY_FACTOR;
      singlePhaseLoads.push({ idx, Psim });
    }
    
    // MCB 選型
    const minBreaker = originalType.includes('Light') ? 10 : 16;
    const breaker = getBreakerSize(Ib, minBreaker);
    const protectionType = getProtectionType(originalType);
    
    // 電壓降
    const vdLimit = getVDLimit(originalType, is3Phase);
    let cableSize = getCableSize(breaker);
    let vd = calcVD(Ib, length, cableSize, is3Phase);
    
    let safetyLoop = 0;
    while (vd > vdLimit && safetyLoop < 10) {
      cableSize = getNextCableSize(cableSize);
      vd = calcVD(Ib, length, cableSize, is3Phase);
      safetyLoop++;
    }
    
    const wirePrefix = is3Phase ? 'R5x' : 'R3x';
    
    results.push({
      circuitNo,
      name,
      assignedPhase: is3Phase ? 'L1/L2/L3' : 'Tx',
      breaker,
      protectionType,
      cable: `${wirePrefix}${cableSize}`,
      vd,
      Pinst,
      df,
      Psim,
      is3Phase,
      singlePhaseIdx: is3Phase ? null : idx
    });
  });
  
  return { results, totalPsim, singlePhaseLoads };
}

function balancePhases(results: CircuitResult[], singlePhaseLoads: SinglePhaseLoad[]): PhaseBalance {
  let sumL1 = 0, sumL2 = 0, sumL3 = 0;
  
  results.forEach(r => {
    if (r.is3Phase) {
      sumL1 += r.Psim / 3;
      sumL2 += r.Psim / 3;
      sumL3 += r.Psim / 3;
    }
  });
  
  singlePhaseLoads.sort((a, b) => b.Psim - a.Psim);
  
  singlePhaseLoads.forEach(load => {
    const resultIdx = load.idx;
    if (sumL1 <= sumL2 && sumL1 <= sumL3) {
      results[resultIdx].assignedPhase = 'L1';
      sumL1 += load.Psim;
    } else if (sumL2 <= sumL1 && sumL2 <= sumL3) {
      results[resultIdx].assignedPhase = 'L2';
      sumL2 += load.Psim;
    } else {
      results[resultIdx].assignedPhase = 'L3';
      sumL3 += load.Psim;
    }
  });
  
  return {
    L1: parseFloat(sumL1.toFixed(2)),
    L2: parseFloat(sumL2.toFixed(2)),
    L3: parseFloat(sumL3.toFixed(2))
  };
}

function getCEMSize(totalKva: number): CEMData {
  let meterKva: number, serviceBreaker: string;
  
  if (totalKva <= 13.8) { meterKva = 13.8; serviceBreaker = '3x20'; }
  else if (totalKva <= 20.7) { meterKva = 20.7; serviceBreaker = '3x32'; }
  else if (totalKva <= 34.5) { meterKva = 34.5; serviceBreaker = '3x50'; }
  else if (totalKva <= 41.4) { meterKva = 41.4; serviceBreaker = '3x60'; }
  else if (totalKva <= 55.2) { meterKva = 55.2; serviceBreaker = '3x80'; }
  else if (totalKva <= 69.0) { meterKva = 69.0; serviceBreaker = '3x100'; }
  else if (totalKva <= 100.0) { meterKva = 100.0; serviceBreaker = '3x150'; }
  else { meterKva = 200.0; serviceBreaker = '3x300'; }
  
  let mainSwitch: string;
  if (serviceBreaker.includes('3x20')) mainSwitch = '32A TP';
  else if (serviceBreaker.includes('3x32')) mainSwitch = '40A TP';
  else if (serviceBreaker.includes('3x50')) mainSwitch = '63A TP';
  else if (serviceBreaker.includes('3x60')) mainSwitch = '80A TP';
  else if (serviceBreaker.includes('3x80')) mainSwitch = '100A TP';
  else if (serviceBreaker.includes('3x100')) mainSwitch = '125A TP';
  else mainSwitch = '160A TP';
  
  return {
    meterKva,
    serviceBreaker: serviceBreaker + ' (A)',
    mainSwitch,
    meterDisplay: `3-Ph Meter (${meterKva} kVA)`
  };
}

// ============================================================
// Main Export Function (主要導出函數)
// ============================================================

export function calculateElectrical(rawInputs: RawInput[]): CalculationResult {
  const circuits = preprocessInputs(rawInputs);
  const { results, totalPsim, singlePhaseLoads } = calculateCircuits(circuits);
  const phaseBalance = balancePhases(results, singlePhaseLoads);
  const cemData = getCEMSize(totalPsim);
  
  return {
    rows: results,
    totalKva: parseFloat(totalPsim.toFixed(2)),
    phaseBalance,
    mainSwitch: cemData.mainSwitch,
    meter: cemData.meterDisplay,
    serviceBreaker: cemData.serviceBreaker,
    meterKva: cemData.meterKva
  };
}
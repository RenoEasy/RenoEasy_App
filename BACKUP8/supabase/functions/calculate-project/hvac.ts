// ============================================================================
// HVAC CALCULATION ENGINE - Supabase Edge Function
// ============================================================================
// Migration from: hvac.js (Frontend)
// Target: Deno + TypeScript serverless environment
// Purpose: Protect IP (engineering parameters) and ensure calculation accuracy
// ============================================================================

import type { HVACInput, HVACResult } from './types.ts';

// ============================================================================
// TRADE SECRETS: Engineering Criteria (DO NOT MODIFY)
// ============================================================================
// Source: Excel table (image_fd7812.png) provided by client
// These values are derived from Macau M&E engineering standards
// CL_W: Cooling Load in Watts per square meter
// reqFA: Requires Fresh Air (boolean override)
// reqEA: Requires Exhaust Air (boolean override)
// ============================================================================

interface SpaceCriteria {
  label: string;
  CL_W: number;    // Cooling load in W/m²
  reqFA: boolean;  // Fresh air requirement (forced override)
  reqEA: boolean;  // Exhaust air requirement (forced override)
}

type SpaceType = 
  | 'office' | 'meeting' | 'pantry' | 'server' 
  | 'retail' | 'pharmacy' | 'dining' | 'kitchen'
  | 'classroom' | 'clinic' | 'beauty' | 'gym' | 'toilet';

const CRITERIA: Record<SpaceType, SpaceCriteria> = {
  "office": { 
    label: "Office (辦公室)", 
    CL_W: 200, 
    reqFA: true, 
    reqEA: false 
  },
  "meeting": { 
    label: "Meeting Room (會議室)", 
    CL_W: 250, 
    reqFA: true, 
    reqEA: false 
  },
  "pantry": { 
    label: "Pantry (茶水間)", 
    CL_W: 250, 
    reqFA: false, 
    reqEA: true 
  },
  "server": { 
    label: "Server Room (機房)", 
    CL_W: 450, 
    reqFA: false, 
    reqEA: false 
  },
  "retail": { 
    label: "Retail Store (零售店)", 
    CL_W: 250, 
    reqFA: true, 
    reqEA: false 
  },
  "pharmacy": { 
    label: "Pharmacy (藥房)", 
    CL_W: 220, 
    reqFA: true, 
    reqEA: false 
  },
  "dining": { 
    label: "Dining Area (餐廳用餐區)", 
    CL_W: 300, 
    reqFA: true, 
    reqEA: false 
  },
  "kitchen": { 
    label: "Kitchen (廚房)", 
    CL_W: 400, 
    reqFA: false, 
    reqEA: true 
  },
  "classroom": { 
    label: "Classroom (補習社)", 
    CL_W: 250, 
    reqFA: true, 
    reqEA: false 
  },
  "clinic": { 
    label: "Clinic (診所)", 
    CL_W: 220, 
    reqFA: true, 
    reqEA: false 
  },
  "beauty": { 
    label: "Beauty Salon (美容院)", 
    CL_W: 250, 
    reqFA: true, 
    reqEA: true 
  },
  "gym": { 
    label: "Gym / Yoga (健身室)", 
    CL_W: 300, 
    reqFA: true, 
    reqEA: true 
  },
  "toilet": { 
    label: "Toilet (廁所)", 
    CL_W: 0, 
    reqFA: false, 
    reqEA: true 
  }
};

// ============================================================================
// Constants
// ============================================================================
const DEFAULTS = {
  HEIGHT: 3.0,        // Default ceiling height (meters)
  HP_TO_WATTS: 2500,  // Macau standard: 1 HP ≈ 2500W cooling capacity
};

// ============================================================================
// Core Calculation Function
// ============================================================================
// Mirrors: hvac.js -> calculateRow()
// Changes: 
// - Removed HTML generation (strCooling, strFA, strEA)
// - Returns clean text strings for display fields
// - Added strict type safety
// ============================================================================

function calculateSpace(input: HVACInput): HVACResult | null {
  try {
    // 1. Validate space type
    const criteria = CRITERIA[input.key as SpaceType];
    if (!criteria) {
      console.error(`[HVAC] Invalid space type: ${input.key}`);
      return null;
    }

    // 2. Parse and sanitize inputs
    const area = parseFloat(String(input.area)) || 0;
    const height = parseFloat(String(input.height ?? DEFAULTS.HEIGHT)) || DEFAULTS.HEIGHT;
    const people = parseFloat(String(input.people ?? 0)) || 0;

    // Validation: area must be positive
    if (area <= 0) {
      console.error(`[HVAC] Invalid area: ${area}`);
      return null;
    }

    // ========================================================================
    // A. COOLING LOAD CALCULATION
    // ========================================================================
    // Formula: Total Cooling (W) = Area (m²) × CL_W (W/m²)
    // Convert to HP: HP = Total Cooling (W) / 2500 (Macau standard)
    // Rounding: Nearest 0.5 HP (e.g., 2.3 → 2.5, 2.8 → 3.0)
    // ========================================================================
    const totalCoolingW = area * criteria.CL_W;
    const coolingHP = criteria.CL_W > 0 ? (totalCoolingW / DEFAULTS.HP_TO_WATTS) : 0;
    
    // Round to nearest 0.5 HP
    // Logic: Math.ceil(x * 2) / 2
    // Examples: 2.3 * 2 = 4.6 → ceil = 5 → 5/2 = 2.5
    //           2.8 * 2 = 5.6 → ceil = 6 → 6/2 = 3.0
    const roundedHP = coolingHP > 0 ? Math.ceil(coolingHP * 2) / 2 : 0;
    
    // Display format: "2.5 HP" or "-" for zero
    const coolingHPDisplay = roundedHP > 0 ? `${roundedHP} HP` : "-";

    // ========================================================================
    // B. FRESH AIR REQUIREMENT
    // ========================================================================
    // Business Logic: Direct lookup from CRITERIA.reqFA
    // No calculation involved - this is a regulatory compliance flag
    // ========================================================================
    const requiresFreshAir = criteria.reqFA;
    const freshAirDisplay = requiresFreshAir ? "YES / 是" : "NO / 否";

    // ========================================================================
    // C. EXHAUST AIR REQUIREMENT
    // ========================================================================
    // Business Logic: Direct lookup from CRITERIA.reqEA
    // No calculation involved - this is a regulatory compliance flag
    // ========================================================================
    const requiresExhaust = criteria.reqEA;
    const exhaustDisplay = requiresExhaust ? "YES / 是" : "NO / 否";

    // ========================================================================
    // D. Construct Result Object
    // ========================================================================
    return {
      id: Date.now(), // Temporary ID (will be replaced by DB auto-increment)
      key: input.key,
      label: criteria.label,
      area: area,
      height: height,
      people: people,
      coolingHP: roundedHP,
      coolingHPDisplay: coolingHPDisplay,
      requiresFreshAir: requiresFreshAir,
      requiresExhaust: requiresExhaust,
      freshAirDisplay: freshAirDisplay,
      exhaustDisplay: exhaustDisplay
    };

  } catch (error) {
    console.error('[HVAC] Calculation error:', error);
    return null;
  }
}

// ============================================================================
// Public API: Batch Calculation
// ============================================================================
// Processes multiple HVAC spaces in a single request
// Returns array of results (filters out nulls from invalid inputs)
// ============================================================================
export function calculateHVAC(inputs: HVACInput[]): HVACResult[] {
  const results: HVACResult[] = [];
  
  for (const input of inputs) {
    const result = calculateSpace(input);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}

// ============================================================================
// Utility: Get Available Space Types
// ============================================================================
// Returns list of valid space types for frontend dropdown
// ============================================================================
export function getSpaceTypes(): Array<{ key: string; label: string }> {
  return Object.entries(CRITERIA).map(([key, criteria]) => ({
    key,
    label: criteria.label
  }));
}

// ============================================================================
// Utility: Validate Space Type
// ============================================================================
// Checks if a given key exists in CRITERIA
// ============================================================================
export function isValidSpaceType(key: string): boolean {
  return key in CRITERIA;
}
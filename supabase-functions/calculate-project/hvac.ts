// ============================================================================
// HVAC CALCULATION ENGINE - Server-Side Only
// Ported from hvac.js - ALL CRITERIA PROTECTED
// ============================================================================

import type { HVACInput, HVACResult } from './types.ts';

// ----------------------------------------------------------------------------
// ENGINEERING CRITERIA - Trade Secret (Not exposed to client)
// Based on Macau M&E engineering standards
// ----------------------------------------------------------------------------
interface SpaceCriteria {
  label: string;
  CL_W: number; // Cooling load per sqm (W/m²)
  reqFA: boolean; // Requires fresh air
  reqEA: boolean; // Requires exhaust air
}

const CRITERIA: Record<string, SpaceCriteria> = {
  office: { label: 'Office (辦公室)', CL_W: 200, reqFA: true, reqEA: false },
  meeting: { label: 'Meeting Room (會議室)', CL_W: 250, reqFA: true, reqEA: false },
  pantry: { label: 'Pantry (茶水間)', CL_W: 250, reqFA: false, reqEA: true },
  server: { label: 'Server Room (機房)', CL_W: 450, reqFA: false, reqEA: false },
  retail: { label: 'Retail Store (零售店)', CL_W: 250, reqFA: true, reqEA: false },
  pharmacy: { label: 'Pharmacy (藥房)', CL_W: 220, reqFA: true, reqEA: false },
  dining: { label: 'Dining Area (餐廳用餐區)', CL_W: 300, reqFA: true, reqEA: false },
  kitchen: { label: 'Kitchen (廚房)', CL_W: 400, reqFA: false, reqEA: true },
  classroom: { label: 'Classroom (補習社)', CL_W: 250, reqFA: true, reqEA: false },
  clinic: { label: 'Clinic (診所)', CL_W: 220, reqFA: true, reqEA: false },
  beauty: { label: 'Beauty Salon (美容院)', CL_W: 250, reqFA: true, reqEA: true },
  gym: { label: 'Gym / Yoga (健身室)', CL_W: 300, reqFA: true, reqEA: true },
  toilet: { label: 'Toilet (廁所)', CL_W: 0, reqFA: false, reqEA: true },
};

const DEFAULTS = {
  HEIGHT: 3.0, // Default ceiling height (meters)
  HP_TO_WATTS: 2500, // 1 HP cooling ≈ 2500W (Macau standard)
};

// ----------------------------------------------------------------------------
// CALCULATION LOGIC
// ----------------------------------------------------------------------------

/**
 * Calculate HVAC requirements for a single space
 * FORMULA PROTECTED - Only returns final results, not intermediate calculations
 */
function calculateSpace(input: HVACInput): HVACResult | null {
  try {
    const criteria = CRITERIA[input.key];
    if (!criteria) {
      throw new Error(`Invalid space type: ${input.key}`);
    }

    const area = input.area || 0;
    const height = input.height || DEFAULTS.HEIGHT;
    const people = input.people || 0;

    // --- A. Cooling Load Calculation ---
    // Formula: Total Cooling (W) = Area (m²) × Cooling Load per m² (W/m²)
    const totalCoolingW = area * criteria.CL_W;
    const coolingHP = criteria.CL_W > 0 ? totalCoolingW / DEFAULTS.HP_TO_WATTS : 0;

    // Round to nearest 0.5 HP (industry standard)
    const roundedHP = coolingHP > 0 ? Math.ceil(coolingHP * 2) / 2 : 0;

    // Display format
    const coolingHPDisplay = roundedHP > 0 ? `${roundedHP} HP` : '-';

    // --- B. Fresh Air Requirement ---
    // Business logic: Forced read from criteria table (no calculation)
    const requiresFreshAir = criteria.reqFA;
    const freshAirDisplay = requiresFreshAir ? 'YES / 是' : 'NO / 否';

    // --- C. Exhaust Air Requirement ---
    // Business logic: Forced read from criteria table (no calculation)
    const requiresExhaust = criteria.reqEA;
    const exhaustDisplay = requiresExhaust ? 'YES / 是' : 'NO / 否';

    return {
      id: Date.now() + Math.random(), // Temporary ID
      key: input.key,
      label: criteria.label,
      area,
      height,
      people,
      coolingHP: roundedHP,
      coolingHPDisplay,
      requiresFreshAir,
      requiresExhaust,
      freshAirDisplay,
      exhaustDisplay,
    };
  } catch (error) {
    console.error('HVAC calculation error:', error);
    return null;
  }
}

// ----------------------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------------------

/**
 * Main calculation function - Entry point for Edge Function
 * Returns array of HVAC results (one per space)
 */
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

/**
 * Get list of available space types (for frontend dropdown)
 * Only exposes labels, NOT calculation parameters
 */
export function getSpaceTypes(): Array<{ key: string; label: string }> {
  return Object.entries(CRITERIA).map(([key, value]) => ({
    key,
    label: value.label,
  }));
}

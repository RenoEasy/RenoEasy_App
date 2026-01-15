const RenoEngine = {
    CONSTANTS: {
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
    },

    preprocessInputs: function(rawInputs) {
        const circuits = [];
        let circuitNo = 1;

        // Step 1: Pre-calculate total circuits per device name for smart numbering
        const nameCounts = {};
        
        const getName = (type) => {
             if (type.includes('Split') || type.includes('分體')) return 'Split-type AC 分體式空調';
             if (type.includes('Outdoor') || type.includes('室外')) return 'VRV Outdoor Unit VRV外機室外機';
             return type;
        };

        // ✅ LOGIC FIX: Define splitting rules strictly
        const getSplitLimit = (type) => {
             // 1. Sockets -> 3 per circuit
             if (type.includes('Socket') || type.includes('插座')) return this.CONSTANTS.SPLIT_LIMITS.SOCKET;
             
             // 2. Lighting -> 15 per circuit
             if (type.includes('Light') || type.includes('照明') || type.includes('招牌')) return this.CONSTANTS.SPLIT_LIMITS.LIGHTING;
             
             // 3. Small Fans / VRV Indoor Units -> 8 per circuit
             if (type.includes('Indoor') || type.includes('風機') || type.includes('Fan')) return this.CONSTANTS.SPLIT_LIMITS.INDOOR;
             
             // 4. Heavy Duty / Default -> 1 per circuit (Forces distinct circuits for Heaters, Kitchen, ACs)
             return 1; 
        };

        // Global counting loop
        rawInputs.forEach(input => {
             if (!input.qty || input.qty <= 0) return;
             const name = getName(input.type);
             const limit = getSplitLimit(input.type);
             const numCircuits = Math.ceil(input.qty / limit);
             nameCounts[name] = (nameCounts[name] || 0) + numCircuits;
        });
        
        const nameIndices = {};

        // Step 2: Generate circuits
        rawInputs.forEach((input) => {
            const { type, phase, qty, power, unit, length } = input;
            
            if (!qty || qty <= 0) return;
            
            let deviceName = getName(type);
            let splitLimit = getSplitLimit(type);
            let df = this.CONSTANTS.DF_VALUES.DEFAULT;
            let finalPower = power;
            let finalUnit = unit;
            
            // VBA: Socket Logic
            if (type.includes('Socket') || type.includes('插座')) {
                df = this.CONSTANTS.DF_VALUES.SOCKET;
                finalPower = 1000;
                finalUnit = 'W';
            } else if (type.includes('Light') || type.includes('照明')) {
                df = this.CONSTANTS.DF_VALUES.LIGHTING;
            } else if (type.includes('Indoor') || type.includes('風機')) {
                df = this.CONSTANTS.DF_VALUES.INDOOR;
                if (!finalPower) { finalPower = 200; finalUnit = 'W'; }
            }
            
            // VBA: HP conversion
            if (finalUnit && (finalUnit.toUpperCase().includes('HP') || finalUnit.includes('匹'))) {
                finalPower = finalPower * 800;
                finalUnit = 'W';
            }
            
            const cableLen = length > 0 ? length : 20;
            let remaining = qty;
            
            // Smart Numbering: If total global circuits > 1, append #1, #2...
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
                    phase: phase || '1',
                    length: cableLen,
                    df: df,
                    originalType: type
                });
                
                remaining -= currentBatch;
                circuitNo++;
            }
        });
        
        return circuits;
    },

    calculateCircuits: function(circuits) {
        const results = [];
        let totalPsim = 0;
        let singlePhaseLoads = [];
        
        circuits.forEach((circuit, idx) => {
            const { circuitNo, name, qty, power, unit, phase, length, df, originalType } = circuit;
            
            let is3Phase = (phase.includes('3'));
            let Pinst;
            
            // VBA: Socket Pinst calculation logic
            if (originalType.includes('Socket') && power === 1000) {
                Pinst = (1000 / 1000) / this.CONSTANTS.POWER_FACTOR;
            } else {
                Pinst = (power * qty / 1000) / this.CONSTANTS.POWER_FACTOR;
            }
            
            const Psim = Pinst * df;
            totalPsim += Psim;
            
            // VBA: Current Ib Calculation (Safety Factor 1.1)
            let Ib;
            if (is3Phase || (Pinst * 1000) >= 5000) {
                is3Phase = true;
                Ib = (Pinst * 1000 / (this.CONSTANTS.VOLTAGE_3PH * this.CONSTANTS.SQRT3)) * this.CONSTANTS.SAFETY_FACTOR;
            } else {
                Ib = (Pinst * 1000 / this.CONSTANTS.VOLTAGE_1PH) * this.CONSTANTS.SAFETY_FACTOR;
                singlePhaseLoads.push({ idx, Psim });
            }
            
            // VBA: MCB Sizing
            const minBreaker = originalType.includes('Light') ? 10 : 16;
            const breaker = this.getBreakerSize(Ib, minBreaker);
            
            // VBA: Protection Type Logic
            const protectionType = this.getProtectionType(originalType);
            
            const vdLimit = this.getVDLimit(originalType, is3Phase);
            let cableSize = this.getCableSize(breaker);
            let vd = this.calcVD(Ib, length, cableSize, is3Phase);
            
            // VBA: VD Loop check
            let safetyLoop = 0;
            while (vd > vdLimit && safetyLoop < 10) {
                cableSize = this.getNextCableSize(cableSize);
                vd = this.calcVD(Ib, length, cableSize, is3Phase);
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
    },

    balancePhases: function(results, singlePhaseLoads) {
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
    },

     getCEMSize: function(totalKva) {
        let meterKva, serviceBreaker;
        
        // 1. 判斷 CEM 引入制 (Service Breaker)
        if (totalKva <= 13.8) { meterKva = 13.8; serviceBreaker = '3x20'; }
        else if (totalKva <= 20.7) { meterKva = 20.7; serviceBreaker = '3x32'; }
        else if (totalKva <= 34.5) { meterKva = 34.5; serviceBreaker = '3x50'; }
        else if (totalKva <= 41.4) { meterKva = 41.4; serviceBreaker = '3x60'; }
        else if (totalKva <= 55.2) { meterKva = 55.2; serviceBreaker = '3x80'; }
        else if (totalKva <= 69.0) { meterKva = 69.0; serviceBreaker = '3x100'; }
        else if (totalKva <= 100.0) { meterKva = 100.0; serviceBreaker = '3x150'; }
        else { meterKva = 200.0; serviceBreaker = '3x300'; }
        
        // 2. 判斷客戶主開關 (Main Switch)
        let mainSwitch;
        if (serviceBreaker.includes('3x20')) mainSwitch = '32A TP';
        else if (serviceBreaker.includes('3x32')) mainSwitch = '40A TP';
        else if (serviceBreaker.includes('3x50')) mainSwitch = '63A TP';
        else if (serviceBreaker.includes('3x60')) mainSwitch = '80A TP';  // 修改後的 80A
        else if (serviceBreaker.includes('3x80')) mainSwitch = '100A TP';
        else if (serviceBreaker.includes('3x100')) mainSwitch = '125A TP'; // 修改後的 125A
        else mainSwitch = '160A TP';
        
        // [修改點] 在回傳前加上單位 (A)
        return { 
            meterKva, 
            serviceBreaker: serviceBreaker + ' (A)', // 加上單位
            mainSwitch, 
            meterDisplay: `3-Ph Meter (${meterKva} kVA)` 
        };
    },

    getBreakerSize: function(ib, minSize) {
        for (let size of this.CONSTANTS.BREAKER_SIZES) {
            if (size >= ib && size >= minSize) return size;
        }
        return 100;
    },

    getCableSize: function(mcb) {
        if (mcb <= 20) return '2.5';
        if (mcb <= 32) return '6';
        if (mcb <= 40) return '10';
        if (mcb <= 63) return '16';
        return '25';
    },

    getNextCableSize: function(currentSize) {
        const idx = this.CONSTANTS.CABLE_SIZES.indexOf(currentSize);
        return idx >= 0 && idx < this.CONSTANTS.CABLE_SIZES.length - 1 ? this.CONSTANTS.CABLE_SIZES[idx + 1] : currentSize;
    },

    calcVD: function(current, length, cableSize, is3Phase) {
        const mvMap = { '1.5': 29, '2.5': 18, '4': 11, '6': 7.3, '10': 4.4, '16': 2.8, '25': 1.75 };
        const mv = mvMap[cableSize] || 1.25;
        const voltage = is3Phase ? this.CONSTANTS.VOLTAGE_3PH : this.CONSTANTS.VOLTAGE_1PH;
        return ((mv * current * length) / 1000) / voltage * 100;
    },

    getVDLimit: function(deviceType, is3Phase) {
        if (deviceType.includes('Light')) return this.CONSTANTS.VD_LIMITS.LIGHTING;
        return is3Phase ? this.CONSTANTS.VD_LIMITS.THREE_PHASE : this.CONSTANTS.VD_LIMITS.SINGLE_PHASE;
    },

     getProtectionType: function(deviceType) {
        // 原本的邏輯：
        // const typeUpper = deviceType.toUpperCase();
        // const isTypeB = (typeUpper.includes('HEATER') || typeUpper.includes('熱水') || typeUpper.includes('W.H.'));
        // return isTypeB ? 'RCD+MCB/RCBO\nType B' : 'RCD+MCB/RCBO\nType C';
        
        // 新邏輯：全部預設 Type C (最通用)
        return 'RCD+MCB/RCBO\nType C';
    },

    calculateProject: function(rawInputs) {
        const circuits = this.preprocessInputs(rawInputs);
        const { results, totalPsim, singlePhaseLoads } = this.calculateCircuits(circuits);
        const phaseBalance = this.balancePhases(results, singlePhaseLoads);
        const cemData = this.getCEMSize(totalPsim);
        
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
};

if (typeof window !== 'undefined') { window.RenoEngine = RenoEngine; }
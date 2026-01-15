const HVACModule = {
    // 1. 數據字典
    CRITERIA: {
        "Toilet (Public)":      { ACH: 15, FA_Rate: 0 },
        "Carpark":              { ACH: 6,  FA_Rate: 0 },
        "Office":               { ACH: 4,  FA_Rate: 10 },
        "Plant Room":           { ACH: 8,  FA_Rate: 0 },
        "Pantry":               { ACH: 4,  FA_Rate: 10 },
        "Toilet (Private)":     { ACH: 15, FA_Rate: 0 },
        "Changing Room":        { ACH: 10, FA_Rate: 0 },
        "Meeting Room":         { ACH: 6,  FA_Rate: 10 },
        "Printing Room":        { ACH: 8,  FA_Rate: 10 },
        "Reception / Lobby":    { ACH: 4,  FA_Rate: 10 },
        "Corridor":             { ACH: 0,  FA_Rate: 0 },
        "Electrical Room":      { ACH: 8,  FA_Rate: 0 },
        "Switch Room (LV/HV)":  { ACH: 8,  FA_Rate: 0 },
        "Genset Room":          { ACH: 30, FA_Rate: 0 },
        "Server / IT Room":     { ACH: 6,  FA_Rate: 0 },
        "Pump Room":            { ACH: 6,  FA_Rate: 0 },
        "Kitchen (Commercial)": { ACH: 30, FA_Rate: 0 },
        "Tea Room / Break":     { ACH: 4,  FA_Rate: 10 },
        "Refuse Room":          { ACH: 20, FA_Rate: 0 },
        "General Store":        { ACH: 2,  FA_Rate: 0 },
        "發電機房":              { ACH: 30, FA_Rate: 0 }
    },

    DEFAULTS: { HEIGHT: 3.0, DUCT_LEN: 20, FRICTION: 1.0 },
    items: [],

    // 2. 計算邏輯
    calculateRow: function(type, area, height, people, ductLen) {
        try {
            const criteria = this.CRITERIA[type];
            if (!criteria) {
                alert(`錯誤：找不到房間類型 "${type}" 的計算參數`);
                return null;
            }

            const A = parseFloat(area) || 0;
            const H = parseFloat(height) || this.DEFAULTS.HEIGHT;
            const Ppl = parseFloat(people) || 0;
            const L = parseFloat(ductLen) || this.DEFAULTS.DUCT_LEN;
            const F = this.DEFAULTS.FRICTION;

            // 計算結果
            const Vol = Math.round((A * H) * 100) / 100;
            
            // [修正點] 變數名稱改為小寫開頭，與 return 物件一致
            const reqEA_CMH = Math.round(Vol * criteria.ACH);
            const reqEA_LS = Math.round((reqEA_CMH / 3.6) * 10) / 10;
            const reqFA_LS = Math.round((Ppl * criteria.FA_Rate) * 10) / 10;
            const ESP = Math.round(L * F);

            return {
                id: Date.now(),
                type, A, H, Ppl, Vol,
                ach: criteria.ACH,
                reqEA_CMH, // 現在變數名稱正確了
                reqEA_LS,  
                reqFA_LS,  
                ESP
            };
        } catch (e) {
            console.error(e);
            alert("計算過程發生錯誤: " + e.message);
            return null;
        }
    },

    // 3. UI 初始化
    init: function() {
        const select = document.getElementById('hvac-type');
        if (!select) return;

        select.innerHTML = '';
        let html = '<option value="">選擇房間類型 Select Type</option>';
        Object.keys(this.CRITERIA).forEach(key => {
            html += `<option value="${key}">${key}</option>`;
        });
        select.innerHTML = html;
        console.log("HVAC Init Complete");
    },

    // 載入數據
    loadData: function(savedItems) {
        this.items = Array.isArray(savedItems) ? savedItems : [];
        this.renderTable();
    },

    // 數據同步
    syncToApp: function() {
        try {
            if (typeof RenoApp === 'undefined') return;
            if (RenoApp.state.currentProjectIdx < 0) return;

            const currentProj = RenoApp.state.projects[RenoApp.state.currentProjectIdx];
            if (!currentProj) return;

            if (!currentProj.hvacData) currentProj.hvacData = [];
            currentProj.hvacData = this.items;
            
            if (typeof RenoApp.saveProjects === 'function') {
                RenoApp.saveProjects();
            }
        } catch (e) {
            console.error("Sync Error:", e);
        }
    },

    addItem: function() {
        try {
            const typeEl = document.getElementById('hvac-type');
            const areaEl = document.getElementById('hvac-area');
            const heightEl = document.getElementById('hvac-height');
            const peopleEl = document.getElementById('hvac-people');
            const ductEl = document.getElementById('hvac-duct-len');

            if (!typeEl || !areaEl) return;

            if (!typeEl.value) {
                alert("請選擇房間用途 (Room Type)");
                return;
            }
            
            if (!areaEl.value || parseFloat(areaEl.value) <= 0) {
                alert("請輸入有效的面積 (Area)");
                areaEl.focus();
                return;
            }

            const result = this.calculateRow(
                typeEl.value, areaEl.value, heightEl.value, peopleEl.value, ductEl.value
            );

            if (result) {
                this.items.push(result);
                this.syncToApp();
                this.renderTable();
                
                // 重置輸入
                areaEl.value = '';
                peopleEl.value = '0';
                areaEl.focus();
            }
        } catch (e) {
            alert("新增項目時發生錯誤: " + e.message);
        }
    },

    removeItem: function(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.syncToApp();
        this.renderTable();
    },

    renderTable: function() {
        const container = document.getElementById('hvac-list-rows');
        if (!container) return;

        const gridStyle = "grid-template-columns: 0.5fr 2fr 0.8fr 0.6fr 0.6fr 0.8fr 0.6fr 1fr 1fr 0.6fr 0.5fr;";

        if (this.items.length === 0) {
            container.innerHTML = '<div style="padding:2rem; text-align:center; color:#a0aec0;">暫無項目 No items added</div>';
            return;
        }

        let html = '';
        this.items.forEach((item, index) => {
            html += `
            <div class="preview-table-row" style="${gridStyle}">
                <div>${index + 1}</div>
                <div style="justify-content:flex-start; padding-left:10px; font-weight:500;">${item.type}</div>
                <div>${item.A}</div>
                <div>${item.H}</div>
                <div>${item.Ppl}</div>
                <div>${item.Vol}</div>
                <div>${item.ach}</div>
                <div style="color:var(--primary-color); font-weight:bold;">${item.reqEA_CMH}</div>
                <div style="color:var(--success-color); font-weight:bold;">${item.reqFA_LS}</div>
                <div>${item.ESP}</div>
                <div><button onclick="HVACModule.removeItem(${item.id})" style="color:red; background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></div>
            </div>`;
        });
        container.innerHTML = html;
    }
};

window.HVACModule = HVACModule;
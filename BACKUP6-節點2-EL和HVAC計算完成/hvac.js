// encoding: utf-8
const HVACModule = {
    // 1. 數據字典 (工程參數庫)
    // 嚴格依據用戶提供的 Excel 圖片 (image_fd7812.png) 設定
    // reqFA: 強制設定鮮風需求 (覆蓋計算值), reqEA: 強制設定排風需求
    CRITERIA: {
        "office":       { label: "Office (辦公室)",           CL_W: 200, reqFA: true,  reqEA: false },
        "meeting":      { label: "Meeting Room (會議室)",     CL_W: 250, reqFA: true,  reqEA: false },
        "pantry":       { label: "Pantry (茶水間)",           CL_W: 250, reqFA: false, reqEA: true  }, // 表格指定: FA=NO, EA=YES
        "server":       { label: "Server Room (機房)",        CL_W: 450, reqFA: false, reqEA: false }, // 表格指定: FA=NO, EA=NO
        "retail":       { label: "Retail Store (零售店)",     CL_W: 250, reqFA: true,  reqEA: false },
        "pharmacy":     { label: "Pharmacy (藥房)",           CL_W: 220, reqFA: true,  reqEA: false },
        "dining":       { label: "Dining Area (餐廳用餐區)",  CL_W: 300, reqFA: true,  reqEA: false },
        "kitchen":      { label: "Kitchen (廚房)",            CL_W: 400, reqFA: false, reqEA: true  }, // 表格指定: FA=NO, EA=YES
        "classroom":    { label: "Classroom (補習社)",        CL_W: 250, reqFA: true,  reqEA: false },
        "clinic":       { label: "Clinic (診所)",             CL_W: 220, reqFA: true,  reqEA: false },
        "beauty":       { label: "Beauty Salon (美容院)",     CL_W: 250, reqFA: true,  reqEA: true  }, // 表格指定: FA=YES, EA=YES
        "gym":          { label: "Gym / Yoga (健身室)",       CL_W: 300, reqFA: true,  reqEA: true  }, // 表格指定: FA=YES, EA=YES
        "toilet":       { label: "Toilet (廁所)",             CL_W: 0,   reqFA: false, reqEA: true  }
    },

    DEFAULTS: { HEIGHT: 3.0 },
    items: [],

    // 2. 計算核心邏輯
    calculateRow: function(key, area, height, people) {
        try {
            const criteria = this.CRITERIA[key];
            if (!criteria) return null;

            const A = parseFloat(area) || 0;
            const H = parseFloat(height) || this.DEFAULTS.HEIGHT;
            const Ppl = parseFloat(people) || 0;
            // const Vol = A * H; // 引流款不需要體積計算，只判定 YES/NO

            // --- A. 冷量計算 (Cooling Load) ---
            // 澳門經驗值: 1 HP (製冷量) approx 2500W
            const totalCoolingW = A * criteria.CL_W;
            const coolingHP = criteria.CL_W > 0 ? (totalCoolingW / 2500) : 0;
            
            // 顯示格式: "2.5 HP"
            const strCooling = coolingHP > 0 
                ? `<span style="font-weight:700; color:#2c5282;">${Math.ceil(coolingHP * 2) / 2} HP</span>` 
                : "<span style='color:#cbd5e0'>-</span>";

            // --- B. 鮮風需求 (Fresh Air) ---
            // 商業邏輯: 強制讀取表格配置 (reqFA)，不進行數值計算
            let strFA;
            if (criteria.reqFA) {
                strFA = `<span class="text-success" style="font-weight:700; font-size:1.1em;">
                            <i class="fas fa-check-circle"></i> 是 / YES
                         </span>`;
            } else {
                strFA = `<span style="color:#cbd5e0; font-weight:500;">否 / NO</span>`;
            }

            // --- C. 排風需求 (Exhaust Air) ---
            // 商業邏輯: 強制讀取表格配置 (reqEA)
            let strEA;
            if (criteria.reqEA) {
                strEA = `<span class="text-danger" style="font-weight:700; font-size:1.1em;">
                            <i class="fas fa-exclamation-circle"></i> 是 / YES
                         </span>`;
            } else {
                strEA = `<span style="color:#cbd5e0; font-weight:500;">否 / NO</span>`;
            }

            return {
                id: Date.now(),
                key,
                label: criteria.label,
                A, H, Ppl,
                strCooling,
                strFA,
                strEA
            };
        } catch (e) {
            console.error(e);
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
            html += `<option value="${key}">${this.CRITERIA[key].label}</option>`;
        });
        select.innerHTML = html;
    },

    loadData: function(savedItems) {
        this.items = Array.isArray(savedItems) ? savedItems : [];
        this.renderTable();
    },

    syncToApp: function() {
        if (typeof RenoApp !== 'undefined' && RenoApp.state.currentProjectIdx >= 0) {
            const currentProj = RenoApp.state.projects[RenoApp.state.currentProjectIdx];
            currentProj.hvacData = this.items;
            RenoApp.saveProjects();
        }
    },

    addItem: function() {
        const typeEl = document.getElementById('hvac-type');
        const areaEl = document.getElementById('hvac-area');
        const heightEl = document.getElementById('hvac-height');
        const peopleEl = document.getElementById('hvac-people');

        if (!typeEl.value || !areaEl.value) {
            alert("請完整輸入類型與面積 (Type & Area required)");
            return;
        }

        const result = this.calculateRow(
            typeEl.value, areaEl.value, heightEl.value, peopleEl.value
        );

        if (result) {
            this.items.push(result);
            this.syncToApp();
            this.renderTable();
            
            // UX 優化: 只重置數值，保留高度
            areaEl.value = '';
            peopleEl.value = '0';
            areaEl.focus();
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

        if (this.items.length === 0) {
            container.innerHTML = '<div class="text-center" style="padding:2rem; color:#a0aec0;">暫無項目 No items added</div>';
            return;
        }

        let html = '';
        this.items.forEach((item, index) => {
            html += `
            <div class="grid-row" style="grid-template-columns: 0.5fr 2fr 0.8fr 0.8fr 1.2fr 1.2fr 1.2fr 0.5fr;">
                <div class="grid-cell" style="color:#718096;">${index + 1}</div>
                <div class="grid-cell" style="justify-content:flex-start; font-weight:600; text-align:left;">${item.label}</div>
                <div class="grid-cell">${item.A}</div>
                <div class="grid-cell">${item.Ppl}</div>
                
                <div class="grid-cell">
                    ${item.strCooling}
                </div>
                <div class="grid-cell">
                    ${item.strFA}
                </div>
                <div class="grid-cell">
                    ${item.strEA}
                </div>
                
                <div class="grid-cell">
                    <button onclick="HVACModule.removeItem(${item.id})" class="btn-danger">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    }
};

window.HVACModule = HVACModule;
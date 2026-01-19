// encoding: utf-8
// encoding: utf-8
const HVACModule = {
    // 1. 數據字典 (僅用於產生下拉選單，核心計算參數已移至後端保護)
    CRITERIA: {
        "office":       { label: "Office (辦公室)" },
        "meeting":      { label: "Meeting Room (會議室)" },
        "pantry":       { label: "Pantry (茶水間)" },
        "server":       { label: "Server Room (機房)" },
        "retail":       { label: "Retail Store (零售店)" },
        "pharmacy":     { label: "Pharmacy (藥房)" },
        "dining":       { label: "Dining Area (餐廳用餐區)" },
        "kitchen":      { label: "Kitchen (廚房)" },
        "classroom":    { label: "Classroom (補習社)" },
        "clinic":       { label: "Clinic (診所)" },
        "beauty":       { label: "Beauty Salon (美容院)" },
        "gym":          { label: "Gym / Yoga (健身室)" },
        "toilet":       { label: "Toilet (廁所)" }
    },

    items: [],

    // 2. 初始化 UI (下拉選單)
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

    // 3. [核心升級] 新增項目 (呼叫 Supabase 雲端計算)
    // [修改] hvac.js
// [修正] hvac.js - addItem (修正變數未定義錯誤 + 保持 dev 函數名稱)
addItem: async function() {
    // 1. [核心修改] 嚴格限制空間數量 (Small Project Limit)
    const MAX_ITEMS = 5; 
    
    if (this.items.length >= MAX_ITEMS) {
        if (typeof RenoApp !== 'undefined') {
            await RenoApp.showCustomModal(
                "達到空間上限 Limit Reached", 
                "⚠️ 本系統專為小型工程 (<69kVA) 設計。\n單一專案最多支援 5 個空間計算。\n\n如需計算更多空間，請建立新專案。", 
                false
            );
        } else {
            alert("已達到空間數量上限 (Max 5 Rooms)");
        }
        return; // ⛔ 阻止繼續執行
    }

    // 2. [補回] 獲取 HTML 輸入框元素 (DOM Elements) - 這是之前報錯缺失的部分
    const typeEl = document.getElementById('hvac-type');
    const areaEl = document.getElementById('hvac-area');
    const heightEl = document.getElementById('hvac-height');
    const peopleEl = document.getElementById('hvac-people');

    // 3. [補回] 基礎驗證 (Validation)
    if (!typeEl || !typeEl.value) {
        if (typeof RenoApp !== 'undefined') await RenoApp.showCustomModal("提示", "請選擇房間用途", false);
        else alert("請選擇房間用途");
        return;
    }
    
    if (!areaEl || !areaEl.value || parseFloat(areaEl.value) <= 0) {
        if (typeof RenoApp !== 'undefined') await RenoApp.showCustomModal("提示", "請輸入有效的面積", false);
        else alert("請輸入有效的面積");
        return;
    }

    // C. 準備數據包 (Payload)
    const inputPayload = {
        key: typeEl.value,
        area: parseFloat(areaEl.value),
        height: parseFloat(heightEl.value) || 3.0,
        people: parseFloat(peopleEl.value) || 0
    };

    // D. UI 鎖定 (Loading)
    // 嘗試抓取按鈕，確保不會因為找不到按鈕而報錯
    const btn = document.querySelector('.sticky-input-bar button') || document.querySelector('.btn-hvac');
    let oldText = "計算 Calc";
    if (btn) {
        oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    try {
        console.log("呼叫 HVAC 雲端計算 (DEV)...");

        // E. 發送請求 (Action: hvac)
        // ✅ [確認] 使用 calculate-project-dev
        const { data, error } = await supabaseClient.functions.invoke('calculate-project-dev', {
            body: { 
                action: 'hvac',         // 告訴後端這是 HVAC 請求
                inputs: [inputPayload]  // 放入陣列
            }
        });

        if (error) throw error;
        if (!data || data.length === 0) throw new Error("無回傳數據");

        const cloudResult = data[0]; // 取回結果

        // F. 格式化顯示 (加上樣式)
        const displayItem = {
            id: Date.now(),
            
            // ✅ 確保詳細數據存在，用於生成 PDF
            detailedLoad: cloudResult.detailedLoad, 

            label: cloudResult.label,
            A: cloudResult.area,
            Ppl: cloudResult.people,
                             
            // 冷量樣式 (藍色粗體)
            strCooling: cloudResult.coolingHP > 0 
                ? `<span style="font-weight:700; color:#2c5282;">${cloudResult.coolingHPDisplay}</span>` 
                : "<span style='color:#cbd5e0'>-</span>",
            
            // 鮮風樣式 (綠色打勾 或 灰色)
            strFA: cloudResult.requiresFreshAir 
                ? `<span class="text-success" style="font-weight:700; font-size:1.1em;"><i class="fas fa-check-circle"></i> ${cloudResult.freshAirDisplay}</span>`
                : `<span style="color:#cbd5e0; font-weight:500;">${cloudResult.freshAirDisplay}</span>`,
            
            // 排風樣式
            strEA: cloudResult.requiresExhaust
                ? `<span class="text-success" style="font-weight:700; font-size:1.1em;"><i class="fas fa-check-circle"></i> ${cloudResult.exhaustDisplay}</span>`
                : `<span style="color:#cbd5e0; font-weight:500;">${cloudResult.exhaustDisplay}</span>`
        };

        // G. 更新列表
        this.items.push(displayItem);
        this.syncToApp();
        this.renderTable();
        
        // 重置輸入框
        areaEl.value = '';
        peopleEl.value = '0';
        areaEl.focus();

    } catch (err) {
        console.error("HVAC Error:", err);
        const msg = err.message || String(err);
        if (typeof RenoApp !== 'undefined' && RenoApp.showCustomModal) {
            await RenoApp.showCustomModal("計算失敗", "雲端錯誤: " + msg, false);
        } else {
            alert("計算失敗: " + msg);
        }
    } finally {
        if (btn) {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
},

    removeItem: function(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.syncToApp();
        this.renderTable();
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

    renderTable: function() {
        const container = document.getElementById('hvac-list-rows');
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `
                <div class="text-center" style="padding:4rem; color:#a0aec0;">
                    <i class="fas fa-wind" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i><br>
                    暫無項目 No items added
                </div>`;
            return;
        }

        let html = '';
        this.items.forEach((item, index) => {
            html += `
            <div class="grid-row" style="grid-template-columns: 0.5fr 1.3fr 0.9fr 0.9fr 1.1fr 1.1fr 1.1fr 0.5fr;">
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

// 確保全域可訪問
window.HVACModule = HVACModule;
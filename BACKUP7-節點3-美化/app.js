// encoding: utf-8
const RenoApp = {
    state: {
        currentUser: null,
        projects: [],
        currentProjectIdx: -1
    },

    // ============================================================
    //  設備類型定義 (已移除 EV，並更新廚房插座)
    // ============================================================
    DEVICE_TYPES: [
        // --- 1. 基礎設備 ---
        { value: '13A Socket Outlet\n13A插座', label: '13A Socket Outlet 13A插座 (普通)', unit: 'N/A', powerDisabled: true, placeholder: 'N/A' },
        { value: 'Lighting\n照明', label: 'Lighting 照明', unit: 'W', powerDisabled: false, placeholder: '50' },
        { value: 'Signage Light\n招牌燈', label: 'Signage Light 招牌燈', unit: 'W', powerDisabled: false, placeholder: '' },

        // --- 2. 空調系統 ---
        { value: 'Split-type AC\n(Input ODU+IDU Total Power)\n分體式空調\n(功率填製冷量)', label: 'Split-type AC 分體式空調 (填製冷量 HP)', unit: 'HP', powerDisabled: false, placeholder: '1.5' },
        { value: 'VRV Indoor Unit\nVRV空調室內機', label: 'VRV Indoor Unit VRV空調室內機', unit: 'W', powerDisabled: false, placeholder: '200' },
        { value: 'VRV Outdoor Unit\n(Input Total Capacity)\nVRV空調系統室外機\n(功率填製冷量)', label: 'VRV Outdoor Unit VRV室外機 (填製冷量 HP)', unit: 'HP', powerDisabled: false, placeholder: '5' },

        // --- 3. 通風設備 ---
        { value: 'Ventilation Fan\n通風機', label: 'Ventilation Fan 通風機 (普通抽氣)', unit: 'W', powerDisabled: false, placeholder: '35' },
        { value: 'Thermo Ventilator\n浴室寶', label: 'Thermo Ventilator 浴室寶 (帶暖氣)', unit: 'W', powerDisabled: false, placeholder: '1350' },

        // --- 4. 廚房與熱水 (修改重點) ---
        
        // [修改] 改名為 "廚房插座"，用於廚房檯面高功率插座 (如電飯煲/水機)
        // 允許輸入功率，Engine 會將其 3 個一組，而非 1 個一組
        { value: 'Kitchen Socket\n廚房插座', label: 'Kitchen Socket 廚房插座 (高負載)', unit: 'W', powerDisabled: false, placeholder: '2000' },
        
        // 電磁爐 (保持獨立)
        { value: 'Induction Cooker\n電磁爐', label: 'Induction Cooker 電磁爐 (高功率)', unit: 'W', powerDisabled: false, placeholder: '2800' },
        
        // 熱水爐
        { value: 'Water Heater (Storage)\n儲水式熱水爐', label: 'Water Heater (Storage) 儲水式熱水爐', unit: 'W', powerDisabled: false, placeholder: '3000' },
        { value: 'Instant Water Heater\n即熱式熱水爐', label: 'Instant Water Heater 即熱式熱水爐', unit: 'W', powerDisabled: false, placeholder: '6000' },

        // --- 5. 其他 (已刪除 EV) ---
        { value: 'Other High-Power\n大功率設備', label: 'Other High-Power 大功率設備', unit: 'W', powerDisabled: false, placeholder: '' }
    ],

    // --- 初始化 ---
    init: function() {
        const savedUser = localStorage.getItem('reno_user');
        if (savedUser) {
            this.state.currentUser = JSON.parse(savedUser);
            this.loadProjects();
            this.updateNavUser();
            this.showPage('page-dashboard');
        } else {
            this.showPage('page-landing');
        }
        this.initDeviceTypeSelector();
    },

    // --- 自製彈窗工具 ---
    // --- [升級] 萬能彈窗控制器 (整合輸入與確認功能) ---
    showCustomModal: function(title, desc, isInputMode = true, placeholder = '') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('reno-modal');
            const titleEl = document.getElementById('modal-title');
            const descEl = document.getElementById('modal-desc'); // 確保 HTML 有這個 ID
            const inputEl = document.getElementById('modal-input');
            const confirmBtn = document.getElementById('modal-btn-confirm');
            const cancelBtn = document.getElementById('modal-btn-cancel');

            if (!overlay || !titleEl || !inputEl) {
                console.error("Modal elements missing!");
                return resolve(null);
            }

            // 1. 設定文字
            titleEl.textContent = title;
            if (descEl) descEl.textContent = desc; // 加入描述文字
            
            // 2. 判斷模式
            if (isInputMode) {
                // 輸入模式：顯示輸入框
                inputEl.classList.remove('hidden');
                inputEl.value = '';
                inputEl.placeholder = placeholder;
                // 自動聚焦
                setTimeout(() => inputEl.focus(), 100);
            } else {
                // 確認模式：隱藏輸入框
                inputEl.classList.add('hidden');
            }

            // 3. 顯示彈窗 (觸發 CSS 動畫)
            overlay.classList.remove('hidden');
            void overlay.offsetWidth; // 強制瀏覽器重繪
            overlay.classList.add('active');

            // 4. 定義清理函式 (關閉彈窗)
            const cleanup = () => {
                overlay.classList.remove('active');
                setTimeout(() => overlay.classList.add('hidden'), 300);
                // 解除事件綁定
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                inputEl.onkeydown = null;
            };

            // 5. 按鈕事件
            confirmBtn.onclick = () => {
                const val = isInputMode ? inputEl.value.trim() : true;
                cleanup();
                resolve(val); // 輸入模式返回字串，確認模式返回 true
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(isInputMode ? null : false); // 取消時返回 null 或 false
            };
            
            // 綁定 Enter 鍵 (僅輸入模式)
            if (isInputMode) {
                inputEl.onkeydown = (e) => {
                    if (e.key === 'Enter') confirmBtn.click();
                    if (e.key === 'Escape') cancelBtn.click();
                };
            }
        });
    },

    initDeviceTypeSelector: function() {
        const selector = document.getElementById('in-type');
        if (!selector) return;
        selector.innerHTML = '<option value="">選擇設備類型 Select Device Type</option>';
        this.DEVICE_TYPES.forEach(dt => {
            const option = document.createElement('option');
            option.value = dt.value;
            option.textContent = dt.label;
            selector.appendChild(option);
        });
    },

    // --- 頁面導航 ---
    showPage: function(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const page = document.getElementById(pageId);
        if (page) {
            page.classList.add('active');
            window.scrollTo(0, 0);
        }
    },

    // --- 登入邏輯 ---
    showLogin: function() { this.showPage('page-landing'); },

    handleLogin: async function() { // 記得加 async
        const phone = document.getElementById('login-id').value.trim();
        if (!phone) { 
            // [修改] 使用美化彈窗
            await this.showCustomModal("提示 Notice", "請輸入電話號碼 (Phone Required)", false);
            return; 
        }
        // ... 後續邏輯不變
        this.state.currentUser = { phone, email: phone + '@demo.com' };
        localStorage.setItem('reno_user', JSON.stringify(this.state.currentUser));
        this.loadProjects();
        this.updateNavUser();
        this.showPage('page-dashboard');
    },

    doLogin: function() { this.handleLogin(); },

    // [修改] 登出 (保留資料，僅清除登入狀態)
    logout: function() {
        this.state.currentUser = null;
        this.state.projects = [];
        this.state.currentProjectIdx = -1;
        
        // 只移除「自動登入」的記號，絕對不要移除專案資料！
        localStorage.removeItem('reno_user');
        
        // [已刪除] localStorage.removeItem('reno_projects');  <-- 兇手就是這一行，刪掉它！

        this.showPage('page-landing');
        
        // 重置導航欄
        const authArea = document.getElementById('nav-auth-area');
        if (authArea) {
            authArea.innerHTML = '<button onclick="RenoApp.showLogin()" class="btn btn-primary">登入 Login</button>';
        }
    },

    updateNavUser: function() {
        // 更新內部導航欄的用戶資訊 (對應新的 HTML ID)
        const displayEl = document.getElementById('app-user-phone');
        if (displayEl && this.state.currentUser) {
            displayEl.textContent = this.state.currentUser.phone;
        }
        
        // 確保首頁 (Landing Page) 的登入狀態邏輯不變
        const landingLinks = document.getElementById('landing-nav-links');
        if(landingLinks) landingLinks.style.display = this.state.currentUser ? 'none' : 'flex';
    },

    // --- 專案存取 ---
    // [修改] 讀取專案 (只讀取當前用戶的資料)
    loadProjects: function() {
        if (!this.state.currentUser || !this.state.currentUser.phone) return;

        const storageKey = 'reno_projects_' + this.state.currentUser.phone;
        const saved = localStorage.getItem(storageKey);
        
        this.state.projects = saved ? JSON.parse(saved) : [];
        this.renderProjectList();
    },

    // [修改] 儲存專案 (根據當前用戶的電話號碼獨立儲存)
    saveProjects: function() {
        if (!this.state.currentUser || !this.state.currentUser.phone) return;
        
        try {
            // 使用動態 Key：reno_projects_66666666
            const storageKey = 'reno_projects_' + this.state.currentUser.phone;
            localStorage.setItem(storageKey, JSON.stringify(this.state.projects));
        } catch (e) {
            console.error('Save failed:', e);
            alert('專案保存失敗 (Storage Full?)');
        }
    },

    // --- 專案管理 ---
    // --- 專案管理 (已升級為美化彈窗) ---
    // --- 專案管理 (已升級為 Custom Modal) ---
    createNewProject: async function() {
        // 使用 await 等待自製彈窗輸入 (isInputMode = true)
        const name = await this.showCustomModal(
            '新建電力專案', 
            '請輸入專案名稱 (Project Name):', 
            true, 
            'e.g. 雅廉訪大馬路裝修'
        );
        
        if (!name) return; // 用戶取消

        this.state.projects.push({
            id: Date.now(),
            type: 'ELECTRICAL',
            name: name,
            inputs: [],
            result: null
        });
        this.state.currentProjectIdx = this.state.projects.length - 1;
        this.saveProjects(); 
        this.openProject(this.state.currentProjectIdx);
    },

    createNewHVACProject: async function() {
        const name = await this.showCustomModal(
            '新建 HVAC 專案', 
            '請輸入專案名稱 (Project Name):', 
            true, 
            'e.g. 氹仔餐廳通風'
        );
        
        if (!name) return;

        this.state.projects.push({
            id: Date.now(),
            type: 'HVAC', 
            name: name,
            hvacData: [],
            inputs: [],
            result: null
        });
        this.state.currentProjectIdx = this.state.projects.length - 1;
        this.saveProjects();
        this.openProject(this.state.currentProjectIdx);
    },

    renderProjectList: function() {
        const listElec = document.getElementById('list-elec');
        const listHvac = document.getElementById('list-hvac');
        const countElec = document.getElementById('count-elec');
        const countHvac = document.getElementById('count-hvac');

        if (!listElec || !listHvac) return;

        // 清空列表
        listElec.innerHTML = '';
        listHvac.innerHTML = '';

        let eCount = 0;
        let hCount = 0;

        // 遍歷所有專案進行分類渲染
        // 注意：我們必須傳遞原始索引 (originalIndex)，否則刪除和開啟功能會錯亂
        this.state.projects.forEach((p, originalIndex) => {
            const isHvac = p.type === 'HVAC';
            
            // 生成卡片 HTML
            const typeClass = isHvac ? 'type-hvac' : 'type-elec';
            const icon = isHvac ? 'fa-wind' : 'fa-bolt';
            const status = isHvac 
                ? `項目數: ${p.hvacData ? p.hvacData.length : 0}` 
                : `設備數: ${p.inputs ? p.inputs.length : 0} | 狀態: ${p.result ? '已核算' : '未核算'}`;
            const btnClass = isHvac ? 'btn-hvac' : 'btn-primary';

            const cardHtml = `
            <div class="project-card ${typeClass}">
                <div onclick="RenoApp.openProject(${originalIndex})" style="cursor: pointer;">
                    <div class="project-title">
                        <i class="fas ${icon}"></i> ${p.name}
                    </div>
                    <div style="font-size: 0.85rem; color: #718096;">${status}</div>
                </div>
                <div class="flex-between" style="margin-top:1rem;">
                    <button onclick="RenoApp.openProject(${originalIndex})" class="btn ${btnClass}" style="padding: 0.4rem 1rem; font-size: 0.9rem;">開啟 Open</button>
                    <button onclick="RenoApp.deleteProject(${originalIndex})" class="btn btn-danger">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;

            // 分流注入 DOM
            if (isHvac) {
                listHvac.innerHTML += cardHtml;
                hCount++;
            } else {
                listElec.innerHTML += cardHtml;
                eCount++;
            }
        });

        // 更新計數器 & 空狀態提示
        if (countElec) countElec.textContent = eCount;
        if (countHvac) countHvac.textContent = hCount;

        if (eCount === 0) listElec.innerHTML = '<div style="color:#cbd5e0; text-align:center; padding:2rem;">暫無電力專案</div>';
        if (hCount === 0) listHvac.innerHTML = '<div style="color:#cbd5e0; text-align:center; padding:2rem;">暫無 HVAC 專案</div>';
    },

    openProject: function(idx) {
        this.state.currentProjectIdx = idx;
        const project = this.state.projects[idx];

        if (project.type === 'HVAC') {
            this.showPage('page-hvac');
            if (typeof HVACModule !== 'undefined') {
                HVACModule.init();
                HVACModule.loadData(project.hvacData || []);
            }
        } else {
            this.showPage('page-workspace');
            this.updateWorkspaceTitle();
            this.renderInputList();
        }
    },

    deleteProject: async function(idx) {
        // 阻止事件冒泡 (如果按鈕在可點擊區域內)
        if (window.event) window.event.stopPropagation();

        // 使用 Custom Modal 的「確認模式」 (isInputMode = false)
        const confirmed = await this.showCustomModal(
            '刪除確認 Confirm Delete', 
            '確定要刪除此專案嗎？此操作無法復原。', 
            false 
        );

        if (!confirmed) return; // 用戶按取消

        this.state.projects.splice(idx, 1);
        this.saveProjects();
        this.renderProjectList();
    },

    // ============================================================
    //  電力計算 Workspace 邏輯
    // ============================================================

    updateWorkspaceTitle: function() {
        const titleEl = document.getElementById('workspace-project-name');
        if (titleEl && this.state.currentProjectIdx >= 0) {
            titleEl.textContent = this.state.projects[this.state.currentProjectIdx].name;
        }
    },

    backToDashboard: function() {
        this.showPage('page-dashboard');
        this.renderProjectList();
    },

    // 1. 自動相位判斷 (Auto Phase Logic)
    autoSetPhase: function() {
        const powerInput = document.getElementById('in-power');
        const phaseSelect = document.getElementById('in-phase');
        const unitDisplay = document.getElementById('in-unit-display');
        
        if (!powerInput || !phaseSelect || !unitDisplay) return;

        let val = parseFloat(powerInput.value) || 0;
        const unit = unitDisplay.textContent.trim();

        // 換算為 Watts 進行判斷
        let equivalentWatts = val;
        if (unit === 'HP') {
            equivalentWatts = val * 800; // 1 HP 約 800W 電功率
        }

        // 若大於 5000W 且當前為單相，自動建議三相
        if (equivalentWatts > 5000) {
            if (phaseSelect.value === '1') {
                phaseSelect.value = '3';
                phaseSelect.style.backgroundColor = '#fff3cd';
                setTimeout(() => { phaseSelect.style.backgroundColor = '#fff'; }, 1000);
            }
        }
    },

    handleDeviceChange: function() {
        const selector = document.getElementById('in-type');
        const selected = this.DEVICE_TYPES.find(d => d.value === selector.value);
        const powerInput = document.getElementById('in-power');
        const unitDisplay = document.getElementById('in-unit-display');
        
        if (!selected) {
            powerInput.value = '';
            powerInput.disabled = false;
            powerInput.style.backgroundColor = '#fff';
            powerInput.placeholder = '';
            unitDisplay.textContent = 'W';
            this.checkInput();
            return;
        }
        powerInput.value = '';
        if (selected.powerDisabled) {
            powerInput.disabled = true;
            powerInput.style.backgroundColor = '#f0f0f0';
            powerInput.placeholder = selected.placeholder;
        } else {
            powerInput.disabled = false;
            powerInput.style.backgroundColor = '#fff';
            powerInput.placeholder = selected.placeholder;
        }
        unitDisplay.textContent = selected.unit;
        document.getElementById('in-phase').value = '1';
        this.checkInput();
    },

    checkInput: function() {
        const type = document.getElementById('in-type').value;
        const qty = parseFloat(document.getElementById('in-qty').value);
        const power = parseFloat(document.getElementById('in-power').value);
        const btn = document.getElementById('btn-add-item');
        let valid = type && qty > 0;
        const selected = this.DEVICE_TYPES.find(d => d.value === type);
        if (selected && !selected.powerDisabled && valid) {
            valid = power > 0;
        }
        btn.disabled = !valid;
    },

    addItem: function() {
        const deviceType = document.getElementById('in-type').value;
        const phaseVal = document.getElementById('in-phase').value;
        const quantity = parseInt(document.getElementById('in-qty').value);
        let power = parseFloat(document.getElementById('in-power').value);
        const unit = document.getElementById('in-unit-display').textContent;
        const length = parseFloat(document.getElementById('in-len').value) || 20;

        const selected = this.DEVICE_TYPES.find(d => d.value === deviceType);
        if (selected && selected.powerDisabled) power = 1000;

        const project = this.state.projects[this.state.currentProjectIdx];
        project.inputs.push({
            id: Date.now(),
            type: deviceType,
            phase: phaseVal, 
            qty: quantity,
            power: power,
            unit: unit,
            length: length
        });

        this.saveProjects();
        this.renderInputList();
        
        document.getElementById('in-type').value = '';
        document.getElementById('in-phase').value = '1';
        document.getElementById('in-qty').value = '';
        document.getElementById('in-power').value = '';
        document.getElementById('btn-add-item').disabled = true;
    },

    renderInputList: function() {
        const container = document.getElementById('added-items-list');
        const project = this.state.projects[this.state.currentProjectIdx];
        if (!project || project.inputs.length === 0) {
            container.innerHTML = '<p class="text-center" style="color:#a0aec0;">尚無設備</p>';
            return;
        }
        container.innerHTML = project.inputs.map((inp, idx) => `
            <div class="load-item">
                <div style="grid-column: span 2;">
                    <strong>${inp.type.split('\n')[0]}</strong>
                    <div style="font-size:0.85rem; color:#718096;">
                        ${inp.phase}-Ph | 數量: ${inp.qty} | 
                        功率: ${inp.unit === 'N/A' ? 'N/A' : inp.power + ' ' + inp.unit} | 
                        長度: ${inp.length}m
                    </div>
                </div>
                <button onclick="RenoApp.deleteInput(${idx})" class="btn-danger">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    deleteInput: function(idx) {
        this.state.projects[this.state.currentProjectIdx].inputs.splice(idx, 1);
        this.saveProjects();
        this.renderInputList();
    },
        // [修正] 移除重複的宣告，確保 async 正確
    calculateResult: async function() {
        const project = this.state.projects[this.state.currentProjectIdx];
        
        // 1. 檢查是否有設備 (使用美化彈窗)
        if (!project || project.inputs.length === 0) {
            await this.showCustomModal("無法計算", "請先添加至少一個設備 (No Items)", false);
            return;
        }

        // 2. 執行計算
        const result = RenoEngine.calculateProject(project.inputs);
        project.result = result;
        this.saveProjects();
        this.renderResultTable();
    },

    renderResultTable: function() {
        const project = this.state.projects[this.state.currentProjectIdx];
        if (!project || !project.result) return;

        const result = project.result;
        document.getElementById('res-demand').textContent = result.totalKva.toFixed(2) + ' kVA';
        document.getElementById('res-meter').textContent = result.meter;

        const previewRows = document.getElementById('result-preview-rows');
        
        previewRows.innerHTML = result.rows.map(r => {
            const isHighCurrentSinglePhase = !r.is3Phase && r.breaker >= 40;
            const breakerClass = isHighCurrentSinglePhase ? 'text-danger' : '';
            const warningIcon = isHighCurrentSinglePhase ? '<i class="fas fa-exclamation-circle"></i> ' : '';
            const vdClass = r.vd > 4 ? 'text-danger' : 'text-success';

            return `
            <div class="grid-row grid-cols-elec blur-text">
                <div class="grid-cell">${r.circuitNo}</div>
                <div class="grid-cell" style="justify-content:flex-start;">${r.name.split('\n')[0]}</div>
                <div class="grid-cell">${r.assignedPhase}</div>
                <div class="grid-cell ${breakerClass}">${warningIcon}${r.breaker}A</div>
                <div class="grid-cell" style="font-size:0.9em;">${r.protectionType}</div>
                <div class="grid-cell">${r.cable}</div>
                <div class="grid-cell ${vdClass}">${r.vd.toFixed(2)}%</div>
                <div class="grid-cell">${r.Pinst.toFixed(2)}</div>
                <div class="grid-cell">${r.df.toFixed(2)}</div>
            </div>`;
        }).join('');

        const warningEl = document.getElementById('res-warning');
        if (result.totalKva >= 69) warningEl.classList.remove('hidden');
        else warningEl.classList.add('hidden');

        this.showPage('page-result');
    },

    // ============================================================
    //  PDF 生成功能 (保持不變)
    // ============================================================
    loadImage: function(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => { console.warn('Logo missing'); resolve(null); };
            img.src = src;
        });
    },

    // [修改] 解鎖功能 - 全面更換為 Custom Modal
    unlockPremium: async function() {
        // 1. 彈出輸入框詢問優惠碼
        const code = await this.showCustomModal(
            "解鎖完整報告 Unlock Premium",
            "【測試】請輸入 VIP888 解鎖下載 (Enter Code):",
            true, // 開啟輸入模式
            "VIP888"
        );

        // 如果用戶按取消 (code 為 null) 或沒輸入，則停止
        if (!code) return;

        // 2. 驗證失敗彈窗
        if (code !== 'VIP888') { 
            await this.showCustomModal(
                "驗證失敗 Verification Failed", 
                "優惠碼錯誤 (Invalid Code)，請重試。", 
                false // 純確認模式
            );
            return; 
        }

        try {
            // ... 原有的 PDF 生成邏輯保持不變 ...
            const project = this.state.projects[this.state.currentProjectIdx];
            const result = project.result;
            if (!result) return;
            const logoImg = await this.loadImage('LOGO.png');
            const tableCanvas = await this.generateReportTableOnly(project, result, logoImg);
            const tableImgData = tableCanvas.toDataURL('image/png');
            const summaryCanvas = await this.generateSummaryBlock(result);
            const summaryImgData = summaryCanvas.toDataURL('image/png');
            const chartCanvas = await this.createPhaseBalanceChart(result.phaseBalance);
            const chartImgData = chartCanvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');
            const PAGE_HEIGHT = 210, PAGE_WIDTH = 297, MARGIN = 10;
            const tableHeightInPDF = tableCanvas.height * (PAGE_WIDTH / tableCanvas.width);
            doc.addImage(tableImgData, 'PNG', 0, 0, PAGE_WIDTH, tableHeightInPDF);
            const FOOTER_HEIGHT = 60;
            let currentY = tableHeightInPDF + 5;
            if (currentY + FOOTER_HEIGHT > (PAGE_HEIGHT - MARGIN)) { doc.addPage(); currentY = 20; }
            doc.addImage(summaryImgData, 'PNG', MARGIN, currentY, 200, 40);
            doc.addImage(chartImgData, 'PNG', 220, currentY - 5, 60, 45);
            this.addPageNumbers(doc);
            doc.save(`RenoEasy_${project.name}.pdf`);
            
            // 3. 成功提示彈窗 (替換 alert)
            await this.showCustomModal(
                "下載成功 Success", 
                "✅ PDF 報告已生成並開始下載。", 
                false
            );

        } catch (e) { 
            console.error(e); 
            // 4. 錯誤提示彈窗 (替換 alert)
            await this.showCustomModal(
                "系統錯誤 Error", 
                "生成失敗: " + e.message, 
                false
            );
        }
    },

    addPageNumbers: function(doc) {
    const totalPages = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10); 
    doc.setTextColor(100);
    
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        // 中間頁碼
        doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        // 左下角 "Powered by RenoEasy"
        doc.text('Powered by RenoEasy', 10, pageHeight - 10, { align: 'left' });
    }
},

    generateReportTableOnly: function(project, result, logoImg) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const WIDTH = 3508;
            const rowCount = result.rows.length;
            const headerHeight = 520;
            const bodyHeight = rowCount * 100;
            const HEIGHT = headerHeight + bodyHeight + 50;
            canvas.width = WIDTH; canvas.height = HEIGHT;
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
            const fontTitle = 'bold 60px "Noto Sans TC", sans-serif';
            const fontHeader = 'bold 32px "Noto Sans TC", sans-serif';
            const fontBody = '30px "Noto Sans TC", sans-serif';
            const fontProjectDate = 'bold 45px "Noto Sans TC", sans-serif';
            let titleX = 450;  // 保持標題位置不變（保留左側空白）
// Logo 已移除，但保留左側 350px 空白區域
        ctx.fillStyle = '#000'; ctx.font = fontTitle; ctx.textAlign = 'left';
ctx.fillText('配電箱負載計算表 / Electrical Load Schedule', titleX, 150);
ctx.font = fontProjectDate;
            ctx.fillText(`Project: ${project.name}`, titleX, 230);
            ctx.fillText(`Date: ${new Date().toLocaleDateString('zh-HK')}`, titleX, 290);
            const infoBoxWidth = 1400; const infoBoxX = WIDTH - infoBoxWidth - 50; const infoBoxY = 80;
            ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(infoBoxX, infoBoxY, infoBoxWidth, 250);
            const labelX = infoBoxX + 40; const valueX = infoBoxX + 900;
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            ctx.fillText('Main Switch Rating (主開關選型):', labelX, infoBoxY + 60);
            ctx.font = '34px "Noto Sans TC", sans-serif'; ctx.fillText(result.mainSwitch, valueX, infoBoxY + 60);
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            ctx.fillText('Contract Power-Palim.(電錶功率):', labelX, infoBoxY + 140);
            ctx.font = '34px "Noto Sans TC", sans-serif'; ctx.fillText(result.meter, valueX, infoBoxY + 140);
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            ctx.fillText('CEM Service Breaker(澳電引入線斷路器):', labelX, infoBoxY + 220);
            ctx.font = '34px "Noto Sans TC", sans-serif'; ctx.fillText(result.serviceBreaker, valueX, infoBoxY + 220);
            const startX = 100; const startY = 400; const tableWidth = WIDTH - 200; const rowH = 120;
            const cols = [
    { name: 'Circuit No.\n迴路編號', w: 0.09 }, 
    { name: 'Description\n用途', w: 0.20 },          // 從 0.23 減少到 0.20 (-0.03)
    { name: 'Phase\n相位', w: 0.07 },
    { name: 'Breaker\n保護器', w: 0.09 }, 
    { name: 'Protection Type\n保護類型', w: 0.14 }, 
    { name: 'Cable Size\n線徑(mm²)', w: 0.11 },
    { name: 'Voltage Drop\n電壓降', w: 0.09 }, 
    { name: 'Installed Power\nPinst(kVA)\n安裝功率', w: 0.12 }, 
    { name: 'Diversity Factor\n同時係數', w: 0.09 }   // 從 0.06 增加到 0.09 (+0.03)
];
            const colX = []; let currentX = startX;
            cols.forEach(c => { colX.push({ x: currentX, width: c.w * tableWidth, name: c.name }); currentX += c.w * tableWidth; });
            ctx.fillStyle = '#0044cc'; ctx.fillRect(startX, startY, tableWidth, rowH);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(startX, startY, tableWidth, rowH);
            ctx.fillStyle = '#fff'; ctx.font = fontHeader; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            colX.forEach((c, i) => {
                if (i > 0) { ctx.beginPath(); ctx.moveTo(c.x, startY); ctx.lineTo(c.x, startY + rowH); ctx.stroke(); }
                const lines = c.name.split('\n');
                lines.forEach((line, li) => { const yOffset = (li - (lines.length-1)/2) * 40; ctx.fillText(line, c.x + c.width/2, startY + rowH/2 + yOffset); });
            });
            let currentY = startY + rowH; const cellH = 100; ctx.font = fontBody; ctx.fillStyle = '#000';
            result.rows.forEach(row => {
                ctx.strokeRect(startX, currentY, tableWidth, cellH);
                const data = [
    row.circuitNo, 
    row.name,  // 這裡保留完整名稱（包含中文和英文）
    row.assignedPhase, 
    row.breaker+'A', 
    row.protectionType, 
    row.cable, 
    row.vd.toFixed(2)+'%', 
    row.Pinst.toFixed(2), 
    row.df.toFixed(2)
];
                colX.forEach((c, i) => {
    if (i > 0) { ctx.beginPath(); ctx.moveTo(c.x, currentY); ctx.lineTo(c.x, currentY + cellH); ctx.stroke(); }
    const strVal = String(data[i]);
    
    // 保留換行符，正確顯示中英文
    if (strVal.includes('\n')) {
        const lines = strVal.split('\n');
        const lineHeight = 35;
        const startY = currentY + cellH/2 - ((lines.length - 1) * lineHeight / 2);
        lines.forEach((line, li) => { 
            ctx.fillText(line, c.x + c.width/2, startY + (li * lineHeight)); 
        });
    } else { 
        ctx.fillText(strVal, c.x + c.width/2, currentY + cellH/2); 
    }
});
                currentY += cellH;
            });
            resolve(canvas);
        });
    },

    generateSummaryBlock: function(result) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 2000; canvas.height = 400;
            ctx.fillStyle = 'rgba(255, 255, 255, 0)'; 
            const fontFooterBig = 'bold 60px "Noto Sans TC", sans-serif';
            const fontFooterMed = 'bold 45px "Noto Sans TC", sans-serif';
            const fontDisclaimer = '38px "Noto Sans TC", sans-serif';
            ctx.textAlign = 'left'; ctx.fillStyle = '#000';
            let startY = 80;
            ctx.font = fontFooterBig;
            ctx.fillText(`Sum. Demand (Psim) 最高總需量: ${result.totalKva.toFixed(2)} kVA`, 0, startY);
            ctx.font = fontFooterMed;
            ctx.fillText(`Phase Balance 三相平衡: L1: ${result.phaseBalance.L1} kVA | L2: ${result.phaseBalance.L2} kVA | L3: ${result.phaseBalance.L3} kVA`, 0, startY + 80);
            const disclaimerY = startY + 180;
            ctx.font = fontDisclaimer;
            ctx.fillText("This report is for reference only and is NOT a formal document signed by a registered engineer.", 0, disclaimerY);
            ctx.fillText("本報告僅供參考，並非由註冊工程師簽署之正式文件", 0, disclaimerY + 60);
            resolve(canvas);
        });
    },

    createPhaseBalanceChart: async function(phaseBalance) {
        const canvas = document.createElement('canvas');
        canvas.width = 1500; canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,1500,1200);
        const L1 = parseFloat(phaseBalance.L1) || 0;
        const L2 = parseFloat(phaseBalance.L2) || 0;
        const L3 = parseFloat(phaseBalance.L3) || 0;
        const totalLoad = L1 + L2 + L3;
        const datasetData = (totalLoad > 0) ? [L1, L2, L3] : [1, 1, 1];
        new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['L1', 'L2', 'L3'],
                datasets: [{
                    data: datasetData,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
                    borderWidth: 5, borderColor: '#fff', hoverOffset: 0
                }]
            },
            options: {
                responsive: false, maintainAspectRatio: true, animation: false,
                layout: { padding: 100 },
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 100 }, padding: 20 } },
                    title: { display: true, text: 'Phase Balance Check', font: { size: 120 }, padding: 30 }
                }
            }
        });
        await new Promise(r => setTimeout(r, 100));
        return canvas;
    }
};

window.onload = () => RenoApp.init();

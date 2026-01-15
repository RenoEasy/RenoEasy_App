const RenoApp = {
    state: {
        currentUser: null,
        projects: [],
        currentProjectIdx: -1
    },

    DEVICE_TYPES: [
        { value: '13A Socket Outlet\n13A插座', label: '13A Socket Outlet 13A插座', unit: 'N/A', powerDisabled: true, placeholder: 'N/A' },
        { value: 'Lighting\n照明', label: 'Lighting 照明', unit: 'W', powerDisabled: false, placeholder: '' },
        { value: 'Signage Light\n招牌燈', label: 'Signage Light 招牌燈', unit: 'W', powerDisabled: false, placeholder: '' },
        { value: 'VRV Indoor Unit\nVRV空調室內機', label: 'VRV Indoor Unit VRV空調室內機', unit: 'W', powerDisabled: false, placeholder: '200' },
        { value: 'Ventilation Fan\n通風機', label: 'Ventilation Fan 通風機', unit: 'W', powerDisabled: false, placeholder: '' },
        { value: 'Split-type AC\n(Input ODU+IDU Total Power)\n分體式空調\n(功率填製冷量)', label: 'Split-type AC 分體式空調 (功率填製冷量)', unit: 'HP', powerDisabled: false, placeholder: '' },
        { value: 'VRV Outdoor Unit\n(Input Total Capacity)\nVRV空調系統室外機\n(功率填製冷量)', label: 'VRV Outdoor Unit VRV空調系統室外機 (功率填製冷量)', unit: 'HP', powerDisabled: false, placeholder: '' },
        { value: 'Water Heater / Kitchen Equipment\n熱水爐/廚房電器', label: 'Water Heater / Kitchen Equipment 熱水爐/廚房電器', unit: 'W', powerDisabled: false, placeholder: '' },
        { value: 'Other High-Power\n大功率設備', label: 'Other High-Power 大功率設備', unit: 'W', powerDisabled: false, placeholder: '' }
    ],

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

    showPage: function(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const page = document.getElementById(pageId);
        if (page) page.classList.add('active');
    },

    showLogin: function() {
        this.showPage('page-landing');
    },

    handleLogin: function() {
        const phone = document.getElementById('login-id').value.trim();
        if (!phone) {
            alert('請輸入電話號碼');
            return;
        }
        this.state.currentUser = { phone, email: phone + '@demo.com' };
        localStorage.setItem('reno_user', JSON.stringify(this.state.currentUser));
        this.loadProjects();
        this.updateNavUser();
        this.showPage('page-dashboard');
    },

    logout: function() {
        this.state.currentUser = null;
        this.state.projects = [];
        this.state.currentProjectIdx = -1;
        localStorage.removeItem('reno_user');
        localStorage.removeItem('reno_projects');
        this.showPage('page-landing');
        document.getElementById('nav-auth-area').innerHTML = 
            '<button onclick="RenoApp.showLogin()" class="btn-primary">登入 Login</button>';
    },

    updateNavUser: function() {
        const area = document.getElementById('nav-auth-area');
        if (this.state.currentUser) {
            area.innerHTML = `
                <span id="display-user">${this.state.currentUser.phone}</span>
                <button onclick="RenoApp.logout()" class="btn-secondary">登出 Logout</button>
            `;
        }
    },

    doLogin: function() { this.handleLogin(); },

    loadProjects: function() {
        const saved = localStorage.getItem('reno_projects');
        this.state.projects = saved ? JSON.parse(saved) : [];
        this.renderProjectList();
    },

    saveProjects: function() {
        try {
            localStorage.setItem('reno_projects', JSON.stringify(this.state.projects));
        } catch (e) {
            console.error('Save failed:', e);
            alert('專案保存失敗');
        }
    },

    createNewProject: function() {
        const name = prompt('請輸入專案名稱:');
        if (!name) return;
        this.state.projects.push({
            id: Date.now(),
            name: name,
            inputs: [],
            result: null
        });
        this.state.currentProjectIdx = this.state.projects.length - 1;
        this.saveProjects();
        this.showPage('page-workspace');
        this.updateWorkspaceTitle();
        this.renderInputList();
    },

    updateWorkspaceTitle: function() {
        const titleEl = document.getElementById('workspace-project-name');
        if (titleEl && this.state.currentProjectIdx >= 0) {
            titleEl.textContent = this.state.projects[this.state.currentProjectIdx].name;
        }
    },

    renderProjectList: function() {
        const list = document.getElementById('project-list');
        if (!list) return;
        if (this.state.projects.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#999;">尚無專案</p>';
            return;
        }
        list.innerHTML = this.state.projects.map((p, idx) => `
            <div class="project-card">
                <div>
                    <h3>${p.name}</h3>
                    <p>設備數量: ${p.inputs.length} | 狀態: ${p.result ? '已核算' : '未核算'}</p>
                </div>
                <div>
                    <button onclick="RenoApp.openProject(${idx})" class="btn-primary">開啟</button>
                    <button onclick="RenoApp.deleteProject(${idx})" class="btn-delete">刪除</button>
                </div>
            </div>
        `).join('');
    },

    openProject: function(idx) {
        this.state.currentProjectIdx = idx;
        this.showPage('page-workspace');
        this.updateWorkspaceTitle();
        this.renderInputList();
    },

    deleteProject: function(idx) {
        if (!confirm('確定刪除此專案？')) return;
        this.state.projects.splice(idx, 1);
        this.saveProjects();
        this.renderProjectList();
    },

    backToDashboard: function() {
        this.showPage('page-dashboard');
        this.renderProjectList();
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
            phase: '',
            qty: quantity,
            power: power,
            unit: unit,
            length: length
        });

        this.saveProjects();
        this.renderInputList();
        
        document.getElementById('in-type').value = '';
        document.getElementById('in-qty').value = '';
        document.getElementById('in-power').value = '';
        document.getElementById('btn-add-item').disabled = true;
    },

    // ✅ FIXED: renderInputList now shows "Length"
    renderInputList: function() {
        const container = document.getElementById('added-items-list');
        const project = this.state.projects[this.state.currentProjectIdx];
        if (!project || project.inputs.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#999;">尚無設備</p>';
            return;
        }
        container.innerHTML = project.inputs.map((inp, idx) => `
            <div class="load-item">
                <div class="load-info">
                    <strong>${inp.type.split('\n')[0]}</strong>
                    <span>
                        數量: ${inp.qty} | 
                        功率: ${inp.unit === 'N/A' ? 'N/A' : inp.power + ' ' + inp.unit} | 
                        長度: ${inp.length}m
                    </span>
                </div>
                <button onclick="RenoApp.deleteInput(${idx})" class="btn-delete">刪除</button>
            </div>
        `).join('');
    },

    deleteInput: function(idx) {
        this.state.projects[this.state.currentProjectIdx].inputs.splice(idx, 1);
        this.saveProjects();
        this.renderInputList();
    },

    calculateResult: function() {
        const project = this.state.projects[this.state.currentProjectIdx];
        if (!project || project.inputs.length === 0) {
            alert('請先添加設備');
            return;
        }
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
        previewRows.innerHTML = result.rows.map(r => `
            <div class="preview-table-row blur-text">
                <div>${r.circuitNo}</div>
                <div>${r.name.split('\n')[0]}</div>
                <div>${r.assignedPhase}</div>
                <div>${r.breaker}A</div>
                <div style="white-space: pre-line;">${r.protectionType}</div>
                <div>${r.cable}</div>
                <div>${r.vd.toFixed(2)}%</div>
                <div>${r.Pinst.toFixed(2)}</div>
                <div>${r.df.toFixed(2)}</div>
                <div>${r.Psim.toFixed(2)}</div>
            </div>
        `).join('');

        const warningEl = document.getElementById('res-warning');
        if (result.totalKva >= 69) warningEl.classList.remove('hidden');
        else warningEl.classList.add('hidden');

        this.showPage('page-result');
    },

    // ==================== PDF Generation (Canvas Method) ====================
    
    loadImage: function(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn('Logo image not found: ' + src);
                resolve(null);
            };
            img.src = src;
        });
    },

    unlockPremium: async function() {
        const code = prompt("【測試】輸入 VIP888 下載 PDF:");
        if (code !== 'VIP888') { alert("優惠碼錯誤"); return; }

        try {
            const project = this.state.projects[this.state.currentProjectIdx];
            const result = project.result;
            if (!result) return;

            const logoImg = await this.loadImage('LOGO.png');
            const tableCanvas = await this.generateReportImage(project, result, logoImg);
            const tableImgData = tableCanvas.toDataURL('image/png');
            const chartCanvas = await this.createPhaseBalanceChart(result.phaseBalance);
            const chartImgData = chartCanvas.toDataURL('image/png');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); 
            
            doc.addImage(tableImgData, 'PNG', 0, 0, 297, 210);
            doc.addImage(chartImgData, 'PNG', 220, 150, 60, 45);

            doc.save(`RenoEasy_${project.name}.pdf`);
            alert('✅ PDF 生成成功！');

        } catch (e) {
            console.error(e);
            alert("生成失敗: " + e.message);
        }
    },

    generateReportImage: function(project, result, logoImg) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const WIDTH = 3508;
            const HEIGHT = 2480;
            canvas.width = WIDTH;
            canvas.height = HEIGHT;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            const fontTitle = 'bold 60px "Noto Sans TC", sans-serif';
            const fontHeader = 'bold 32px "Noto Sans TC", sans-serif';
            const fontBody = '30px "Noto Sans TC", sans-serif';
            const fontProjectDate = 'bold 45px "Noto Sans TC", sans-serif';
            const fontFooterBig = 'bold 60px "Noto Sans TC", sans-serif';
            const fontFooterMed = 'bold 45px "Noto Sans TC", sans-serif';
            const fontDisclaimer = '48px "Noto Sans TC", sans-serif';

            // Header Section
            let titleX = 100;
            if (logoImg) {
                const logoW = 300;
                const logoH = logoW * (logoImg.height / logoImg.width);
                ctx.drawImage(logoImg, 100, 60, logoW, logoH);
                titleX = 450;
            }

            ctx.fillStyle = '#000';
            ctx.font = fontTitle;
            ctx.textAlign = 'left';
            ctx.fillText('RenoEasy Calc - Load Schedule', titleX, 150);
            
            ctx.font = fontProjectDate;
            ctx.fillText(`Project: ${project.name}`, titleX, 230);
            ctx.fillText(`Date: ${new Date().toLocaleDateString('zh-HK')}`, titleX, 290);

            // Info Box - Widen box to 1150 to fit "澳電引入線斷路器"
            const infoBoxWidth = 1150; 
            const infoBoxX = WIDTH - infoBoxWidth - 50;
            const infoBoxY = 80;
            
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeRect(infoBoxX, infoBoxY, infoBoxWidth, 250);
            
            const labelX = infoBoxX + 40;
            const valueX = infoBoxX + 680;
            
            // Row 1
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            ctx.fillText('Main Switch 主開關:', labelX, infoBoxY + 60);
            ctx.font = '34px "Noto Sans TC", sans-serif';
            ctx.fillText(result.mainSwitch, valueX, infoBoxY + 60);
            
            // Row 2
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            ctx.fillText('Meter 電錶:', labelX, infoBoxY + 140);
            ctx.font = '34px "Noto Sans TC", sans-serif';
            ctx.fillText(result.meter, valueX, infoBoxY + 140);

            // Row 3
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            ctx.fillText('CEM Breaker 澳電引入線斷路器:', labelX, infoBoxY + 220);
            ctx.font = '34px "Noto Sans TC", sans-serif';
            ctx.fillText(result.serviceBreaker, valueX, infoBoxY + 220);

            // Table Section
            const startX = 100;
            const startY = 400;
            const tableWidth = WIDTH - 200;
            
            const cols = [
                { name: 'Circuit No.\n迴路編號', w: 0.09 },
                { name: 'Description\n用途', w: 0.23 },
                { name: 'Phase\n相位', w: 0.07 },
                { name: 'Breaker\n保護器', w: 0.09 },
                { name: 'Protection Type\n保護類型', w: 0.14 },
                { name: 'Cable Size\n線徑(mm²)', w: 0.11 },
                { name: 'Voltage Drop\n電壓降', w: 0.09 },
                { name: 'Installed Power\nPinst\n安裝功率(kVA)', w: 0.12 },
                { name: 'DF\n同時係數', w: 0.06 }
            ];

            const colX = [];
            let currentX = startX;
            cols.forEach(c => {
                colX.push({ x: currentX, width: c.w * tableWidth, name: c.name });
                currentX += c.w * tableWidth;
            });

            // Draw Header
            const rowH = 120;
            ctx.fillStyle = '#0044cc';
            ctx.fillRect(startX, startY, tableWidth, rowH);
            
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, startY, tableWidth, rowH);

            ctx.fillStyle = '#fff';
            ctx.font = fontHeader;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            colX.forEach((c, i) => {
                if (i > 0) {
                    ctx.beginPath();
                    ctx.moveTo(c.x, startY);
                    ctx.lineTo(c.x, startY + rowH);
                    ctx.stroke();
                }
                const lines = c.name.split('\n');
                lines.forEach((line, li) => {
                    const yOffset = (li - (lines.length-1)/2) * 40;
                    ctx.fillText(line, c.x + c.width/2, startY + rowH/2 + yOffset);
                });
            });

            // Draw Body
            let currentY = startY + rowH;
            const cellH = 100;
            
            ctx.font = fontBody;
            ctx.fillStyle = '#000';

            result.rows.forEach(row => {
                ctx.strokeRect(startX, currentY, tableWidth, cellH);

                const data = [
                    row.circuitNo,
                    row.name,
                    row.assignedPhase,
                    row.breaker + 'A',
                    row.protectionType,
                    row.cable,
                    row.vd.toFixed(2) + '%',
                    row.Pinst.toFixed(2),
                    row.df.toFixed(2)
                ];

                colX.forEach((c, i) => {
                    if (i > 0) {
                        ctx.beginPath();
                        ctx.moveTo(c.x, currentY);
                        ctx.lineTo(c.x, currentY + cellH);
                        ctx.stroke();
                    }
                    
                    const strVal = String(data[i]);
                    if (strVal.includes('\n')) {
                        const lines = strVal.split('\n');
                        lines.forEach((line, li) => {
                            const yOffset = (li - (lines.length-1)/2) * 35;
                            ctx.fillText(line, c.x + c.width/2, currentY + cellH/2 + yOffset);
                        });
                    } else {
                        ctx.fillText(strVal, c.x + c.width/2, currentY + cellH/2);
                    }
                });

                currentY += cellH;
            });

            // Footer Section
            const footerY = currentY + 80;
            ctx.textAlign = 'left';
            ctx.fillStyle = '#000';
            
            ctx.font = fontFooterBig;
            ctx.fillText(`Sum. Demand (Psim) 最高總需量: ${result.totalKva.toFixed(2)} kVA`, startX, footerY);

            ctx.font = fontFooterMed;
            ctx.fillText(`Phase Balance 三相平衡: L1: ${result.phaseBalance.L1} kVA | L2: ${result.phaseBalance.L2} kVA | L3: ${result.phaseBalance.L3} kVA`, startX, footerY + 80);

            // Disclaimer - No Blue Box, Black Text, No Period
            const disclaimerY = HEIGHT - 200;
            
            ctx.fillStyle = '#000000'; 
            ctx.font = fontDisclaimer;
            
            const disclaimerLineEN = "This report is for reference only and is NOT a formal document signed by a registered engineer.";
            const disclaimerLineCN = "本報告僅供參考，並非由註冊工程師簽署之正式文件";
            
            ctx.fillText(disclaimerLineEN, startX, disclaimerY);
            ctx.fillText(disclaimerLineCN, startX, disclaimerY + 60);

            resolve(canvas);
        });
    },

    createPhaseBalanceChart: async function(phaseBalance) {
        const canvas = document.createElement('canvas');
        canvas.width = 1500;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,1500,1200);

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
                    borderWidth: 5,
                    borderColor: '#fff',
                    hoverOffset: 0
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: true,
                animation: false,
                layout: {
                    padding: 100
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 100 },
                            padding: 20
                        }
                    },
                    title: {
                        display: true,
                        text: 'Phase Balance Check',
                        font: { size: 120 },
                        padding: 30
                    },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const percentage = ((value / totalLoad) * 100).toFixed(1);
                                const displayPercentage = (isNaN(percentage) || totalLoad === 0) ? 'N/A' : percentage + '%';
                                return context.label + ': ' + value.toFixed(2) + ' kVA (' + displayPercentage + ')';
                            }
                        }
                    }
                }
            }
        });

        await new Promise(r => setTimeout(r, 100));
        return canvas;
    }
};

window.onload = () => RenoApp.init();
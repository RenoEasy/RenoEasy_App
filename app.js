// encoding: utf-8

// encoding: utf-8

// ==========================================
// 1. 初始化 Supabase (修正命名衝突)
// ==========================================
const SUPABASE_URL = 'https://tjavymruxsqkexczmxvd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqYXZ5bXJ1eHNxa2V4Y3pteHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MzcxMTksImV4cCI6MjA4MzQxMzExOX0._769_JX4HDWjg01Ch_vhNgVsSSg0vLthHFT6NzB642g';

// ⚠️ 注意：這裡改名叫 supabaseClient，避免跟工具箱名字打架
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// ==========================================

const RenoApp = {
    // ... 下面不用動，直到 handleLogin ...
    // ...
    state: {
        currentUser: null,
        projects: [],
        currentProjectIdx: -1
    },

    // ============================================================
    //  設備類型定義 (已移除 EV，並更新廚房插座)1
    // ============================================================
    DEVICE_TYPES: [
        // --- 1. 基礎設備 ---
        { 
            value: 'General Socket\n一般插座', 
            label: 'General Socket 一般插座 (400W)', 
            unit: 'W', 
            powerDisabled: true, // ✅ 鎖定功率
            placeholder: '400' 
        },
        { 
            value: 'Kitchen Socket\n廚房插座', 
            label: 'Kitchen Socket 廚房插座 (1500W)', 
            unit: 'W', 
            powerDisabled: true, // ✅ 鎖定功率
            placeholder: '1500' 
        },
        { value: 'Lighting\n照明', label: 'Lighting 照明', unit: 'W', powerDisabled: false, placeholder: '50' },
        { value: 'Signage Light\n招牌燈', label: 'Signage Light 招牌燈', unit: 'W', powerDisabled: false, placeholder: '' },

        // --- 2. 空調系統 ---
        { value: 'Split-type AC\n(Input ODU+IDU Total Power)\n分體式空調\n(功率填製冷量)', label: 'Split-type AC 分體式空調 (填製冷量 HP)', unit: 'HP', powerDisabled: false, placeholder: '1.5' },
        { value: 'VRV Indoor Unit\nVRV空調室內機', label: 'VRV Indoor Unit VRV空調室內機', unit: 'W', powerDisabled: false, placeholder: '200' },
        { value: 'VRV Outdoor Unit\n(Input Total Capacity)\nVRV空調系統室外機\n(功率填製冷量)', label: 'VRV Outdoor Unit VRV室外機 (填製冷量 HP)', unit: 'HP', powerDisabled: false, placeholder: '5' },

        // --- 3. 通風設備 ---
        { value: 'Ventilation Fan\n通風機', label: 'Ventilation Fan 通風機 (普通抽氣)', unit: 'W', powerDisabled: false, placeholder: '35' },
        { value: 'Thermo Ventilator\n浴室寶', label: 'Thermo Ventilator 浴室寶 (帶暖氣)', unit: 'W', powerDisabled: false, placeholder: '1350' },

        
        
        // 電磁爐 (保持獨立)
        { value: 'Induction Cooker\n電磁爐', label: 'Induction Cooker 電磁爐 (高功率)', unit: 'W', powerDisabled: false, placeholder: '2800' },
        
        // 熱水爐
        { value: 'Water Heater (Storage)\n儲水式熱水爐', label: 'Water Heater (Storage) 儲水式熱水爐', unit: 'W', powerDisabled: false, placeholder: '3000' },
        { value: 'Instant Water Heater\n即熱式熱水爐', label: 'Instant Water Heater 即熱式熱水爐', unit: 'W', powerDisabled: false, placeholder: '6000' },

        // --- 5. 其他 (已刪除 EV) ---
        { value: 'Other High-Power\n大功率設備', label: 'Other High-Power 大功率設備', unit: 'W', powerDisabled: false, placeholder: '' }
    ],

    init: function() {
        // ✅ [新增] 網頁啟動時，立即初始化下拉選單
        this.initDeviceTypeSelector(); 

        const initialHash = window.location.hash;
        console.log("App Init - Hash:", initialHash);

        // 1. 錯誤偵測 (連結失效)
        if (initialHash && (initialHash.includes('error=access_denied') || initialHash.includes('otp_expired'))) {
            window.history.replaceState(null, null, window.location.pathname);
            setTimeout(() => {
                this.showCustomModal("連結已失效", "此連結已過期，請重新發送。", false);
            }, 500);
            return;
        }

        // 2. 監聽事件
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log("🔴 Auth Event Detected:", event);

            // ✅ [關鍵修改] 允許 INITIAL_SESSION 通過檢查
            const isRecovery = (event === "PASSWORD_RECOVERY") || 
                               ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && initialHash && initialHash.includes('type=recovery'));

            if (isRecovery) {
                console.log("✅ 捕捉到重設請求 (via " + event + ")");
                
                // 清理網址
                window.history.replaceState(null, null, window.location.pathname);

                setTimeout(async () => {
                    // 避免重複彈窗
                    if(document.getElementById('reno-modal').classList.contains('active')) return;

                    const newPassword = await this.showCustomModal(
                        "重設密碼 Reset Password", 
                        "驗證成功！請輸入新密碼：", 
                        true, 
                        "新密碼 (至少 6 位)"
                    );

                    if (newPassword && newPassword.length >= 6) {
                        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
                        if (error) {
                            await this.showCustomModal("錯誤", error.message, false);
                        } else {
                            await this.showCustomModal("成功", "密碼已更新，請重新登入。", false);
                            this.logout(); 
                        }
                    }
                }, 500);
            }
        });

        const savedUser = localStorage.getItem('reno_user');
        if (savedUser) {
            const userObj = JSON.parse(savedUser);
            this.state.currentUser = userObj;
            
            // 🛑 [插入] 自動登入時的檢查
            // 注意：因為 init 是同步執行的，我們在這裡觸發檢查，但不阻塞頁面加載
            // 這樣用戶會先看到畫面，然後立刻彈窗
            setTimeout(async () => {
                // 我們需要一個類似 Supabase User 的物件結構來傳給守門員
                // 如果本地緩存沒有 email，就去 Supabase 查最新的 Session
                const { data } = await supabaseClient.auth.getUser();
                if (data && data.user) {
                    // 使用最新的雲端數據進行檢查
                    const pass = await this.enforceEmailBinding(data.user);
                    if (pass) {
                        // 如果通過檢查 (或補填成功)，更新本地緩存的 email
                        this.state.currentUser.email = data.user.email;
                        localStorage.setItem('reno_user', JSON.stringify(this.state.currentUser));
                    }
                }
            }, 500); // 延遲 0.5 秒執行，確保 UI 已渲染

            // ... (原代碼繼續) ...
            this.loadProjects().then(() => {
                 this.updateUserUI();
                 if (this.state.currentUser.id) {
                     this.fetchUserProfile({ id: this.state.currentUser.id });
                 }
                 this.showPage('page-dashboard');
            });
        } else {
            this.showPage('page-landing');
        }


        // [支付回調檢測]
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(async () => {
                await this.showCustomModal(
                    '🎉 支付成功 Payment Successful', 
                    '感謝您的購買！訂單已確認。\n\n系統正在為您生成專業工程報告...', 
                    false
                );
                if (this.state.projects.length > 0) {
                    this.state.currentProjectIdx = this.state.projects.length - 1;
                    this.generatePDFProcess();
                }
            }, 1000);
        }
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

    // ============================================================
    // [已修正] 方案 A：電話註冊 (SMS) + 綁定電郵 (Email Verify)
    // ============================================================
    
    handleLogin: async function(actionType) {
        // 1. 獲取輸入
        const phoneInput = document.getElementById('login-id');
        const pwdInput = document.getElementById('login-pwd');
        const emailInput = document.getElementById('login-email'); // 新增
        
        // 格式化電話 (+853)
        let rawPhone = phoneInput.value.trim().replace(/\s/g, '');
        if (!rawPhone) {
            await this.showCustomModal("提示", "請輸入電話號碼", false);
            return;
        }
        let phone = rawPhone.startsWith('+') ? rawPhone : '+853' + rawPhone;

        const password = pwdInput.value.trim();
        const email = emailInput.value.trim();

        // 2. 基礎檢查
        if (password.length < 6) {
            await this.showCustomModal("提示", "密碼長度至少需 6 位數", false);
            return;
        }

        // 3. UI 鎖定
        const loginBtn = document.querySelector('button[onclick*="LOGIN"]');
        const regBtn = document.querySelector('button[onclick*="REGISTER"]');
        let oldText = "";

        if (actionType === 'LOGIN') {
            if(loginBtn) { oldText = loginBtn.innerHTML; loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登入中...'; loginBtn.disabled = true; }
        } else {
            // 註冊時必須檢查 Email
            if (!email || !email.includes('@')) {
                await this.showCustomModal("提示", "註冊必須填寫正確的 Email，以便日後找回密碼。", false);
                return;
            }
            if(regBtn) { oldText = regBtn.innerHTML; regBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 註冊中...'; regBtn.disabled = true; }
        }

        try {
            let data, error;

            if (actionType === 'REGISTER') {
                // ==========================
                //  流程 A: 註冊 (Phone + SMS + Bind Email)
                // ==========================
                console.log(`正在註冊: ${phone}`);

                // Step 1: 建立電話帳號 (發送 SMS)
                const signUpRes = await supabaseClient.auth.signUp({
                    phone: phone,
                    password: password
                });
                if (signUpRes.error) throw signUpRes.error;

                // Step 2: 輸入 SMS 驗證碼
                const token = await this.showCustomModal(
                    "安全驗證 Verification", 
                    `驗證碼已發送至 ${phone}，請輸入 6 位數代碼:`, 
                    true, 
                    "123456"
                );

                if (!token) throw new Error("用戶取消驗證");

                // Step 3: 驗證 SMS
                const verifyRes = await supabaseClient.auth.verifyOtp({
                    phone: phone,
                    token: token,
                    type: 'sms'
                });
                if (verifyRes.error) throw verifyRes.error;

                //此時用戶已登入，session 建立
                
                // Step 4: [關鍵] 立即綁定 Email
                // 這會觸發 Supabase 發送一封 "Confirm Email" 到該信箱
                const updateRes = await supabaseClient.auth.updateUser({ email: email });
                
                if (updateRes.error) {
    console.warn("Email綁定失敗:", updateRes.error);
    await this.showCustomModal("Email 綁定失敗", "無法綁定此 Email (可能已被使用)。\n註冊未完成，請重新註冊。", false);
    
    // 🛑 [新增] 嚴格模式：綁定失敗視為註冊失敗，強制登出並清除髒數據
    await supabaseClient.auth.signOut();
    return; // 終止流程
} else {
                    await this.showCustomModal(
                        "註冊成功 Registration Success", 
                        `帳號已啟用！\n\n系統已發送一封【確認信】至 ${email}。\n請務必前往信箱點擊確認連結，否則未來無法使用「找回密碼」功能。`, 
                        false
                    );
                }
                
                data = verifyRes.data; // 準備進入 Dashboard

            } else {
                // ==========================
                //  流程 B: 登入 (Phone + Password)
                // ==========================
                console.log(`正在登入: ${phone}`);
                const signInRes = await supabaseClient.auth.signInWithPassword({
                    phone: phone,
                    password: password
                });
                data = signInRes.data;
                error = signInRes.error;
            }

            // 4. 處理結果
            if (error) {
                console.error("Auth Error:", error);
                let msg = "帳號或密碼錯誤";
                if (error.message.includes("Invalid login")) msg = "電話或密碼錯誤";
                if (error.message.includes("already registered")) msg = "此電話已註冊，請直接登入";
                await this.showCustomModal("操作失敗", msg, false);
            } else if (data && data.user) {
                // 成功登入
                
                // 🛑 [插入] 呼叫守門員檢查
                // 如果 enforceEmailBinding 回傳 false，代表用戶拒絕綁定，直接終止流程
                const pass = await this.enforceEmailBinding(data.user);
                if (!pass) return; 

                // --- 檢查通過，繼續執行原邏輯 ---
                this.state.currentUser = { 
                    phone: phone, 
                    id: data.user.id,
                    email: data.user.email // [順便更新] 把 email 也存入本地狀態
                };
                
                // ... (以下保持原代碼不變: fetchUserProfile, loadProjects 等) ...
                await this.fetchUserProfile(data.user);
                // ...
                
                // ✅ [新增] 登入成功後，立刻去 Supabase 抓取點數
                await this.fetchUserProfile(data.user);
                
                // (fetchUserProfile 內部會更新 state 和 localStorage，所以這裡不需要再 setItem)
                // 為了保險起見，如果 fetch 失敗，我們還是存一個基礎版
                if (!this.state.currentUser.credits) {
                    localStorage.setItem('reno_user', JSON.stringify(this.state.currentUser));
                }

                this.loadProjects();
                // this.updateNavUser(); // fetchUserProfile 已經會呼叫 updateUserUI 了
                this.showPage('page-dashboard');
                // 清空敏感欄位
                pwdInput.value = '';
            }

        } catch (err) {
            console.error("System Error:", err);
            if (err.message !== "用戶取消驗證") {
                await this.showCustomModal("系統提示", err.message, false);
            }
        } finally {
            if (actionType === 'LOGIN' && loginBtn) { loginBtn.innerHTML = oldText; loginBtn.disabled = false; }
            if (actionType === 'REGISTER' && regBtn) { regBtn.innerHTML = oldText; regBtn.disabled = false; }
        }
    },

    // [新增] 找回密碼功能
    resetPassword: async function() {
        // 1. 索取 Email
        const email = await this.showCustomModal(
            "找回密碼 Reset Password",
            "請輸入您註冊時綁定的 Email：",
            true,
            "yourname@example.com"
        );

        if (!email) return;

        try {
            // 2. 發送重設信 (Supabase 標準功能)
            const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.href, // 重設後跳轉回當前頁面
            });

            if (error) throw error;

            await this.showCustomModal(
                "郵件已發送", 
                "如果該 Email 已驗證，您將收到重設密碼連結。\n請檢查收件匣或垃圾郵件。", 
                false
            );

        } catch (err) {
            console.error(err);
            await this.showCustomModal("發送失敗", "錯誤: " + err.message, false);
        }
    },

    // ============================================
    // [新增] 強制綁定 Email 守門員 (Security Gatekeeper)
    // ============================================
    enforceEmailBinding: async function(user) {
        // 1. 如果 Supabase 用戶物件已有 Email，直接放行
        if (user.email) return true;

        console.log("⚠️ 檢測到用戶無 Email，啟動強制補填流程...");

        let emailBound = false;
        
        // 進入死循環，直到綁定成功或用戶放棄
        while (!emailBound) {
            // A. 強制彈窗索取 Email
            const newEmail = await this.showCustomModal(
                "資料補充 Action Required", 
                "⚠️ 您的帳號尚未綁定 Email。\n為了保障帳號安全及接收報告，請立即輸入 Email：", 
                true, 
                "example@email.com"
            );

            // B. 如果用戶按取消 (返回 null)，視為拒絕服務 -> 強制登出
            if (!newEmail) {
                await this.showCustomModal("限制存取 Access Denied", "抱歉，未綁定 Email 無法使用本系統。\n系統將自動登出。", false);
                await supabaseClient.auth.signOut();
                this.logout();
                return false; // 回傳失敗
            }

            // C. 嘗試綁定 (呼叫 Supabase)
            // 顯示 Loading 狀態
            const modalTitle = document.getElementById('modal-title');
            if(modalTitle) modalTitle.innerText = "正在綁定 Binding...";
            
            const { data, error } = await supabaseClient.auth.updateUser({ email: newEmail });
            
            if (error) {
                // 綁定失敗 (通常是 Email 格式錯誤或已被占用)
                await this.showCustomModal("綁定失敗 Failed", "錯誤: " + error.message + "\n請嘗試其他 Email。", false);
                // loop 繼續，讓用戶重填
            } else {
                // D. 綁定成功
                await this.showCustomModal("綁定成功 Success", "✅ Email 已更新！\n系統已發送確認信，請務必查收驗證。", false);
                
                // 更新本地狀態 (很重要，否則畫面不會變)
                if (this.state.currentUser) {
                    this.state.currentUser.email = newEmail;
                }
                
                emailBound = true;
                return true; // 回傳成功，允許進入
            }
        }
    },

    // [新增] 手機版選單開關
    toggleMobileMenu: function() {
        const nav = document.getElementById('sidebar-nav-list');
        const btn = document.getElementById('mobile-menu-toggle');
        
        if (!nav) return;

        // 切換 active class
        nav.classList.toggle('active');

        // 切換按鈕圖標 (三條線 <-> 叉叉)
        if (nav.classList.contains('active')) {
            btn.innerHTML = '<i class="fas fa-times"></i>'; // 變成叉叉
        } else {
            btn.innerHTML = '<i class="fas fa-bars"></i>';  // 變回三條線
        }
    },

    // 統一入口
    doLogin: function(type) { 
        this.handleLogin(type); 
    },

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

    // ============================================
    // [補回] 支付系統與 PDF 生成 (Payment & PDF Logic)
    // ============================================

    // 1. 打開支付彈窗 (包含鎖定滾動)
    unlockPremium: function() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex'; 
            
            // [Phase 1 修改] 強制切換到優惠碼 Tab，忽略餘額檢查
            // this.checkBalanceForModal(); // 暫時註解
            this.switchTab('promo'); 
            
            // [Phase 1 修改] 自動填入 VIP888 (提升體驗)
            const promoInput = document.getElementById('promo-code-input');
            if(promoInput) promoInput.value = 'VIP888';

            // 鎖定背景滾動
            document.body.style.overflow = 'hidden'; 
        }
    },

    // 2. 關閉支付彈窗 (包含解鎖滾動)
    closePaymentModal: function() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.classList.add('hidden');
            // ✅ 立即恢復滾動
            document.body.style.overflow = ''; 

            setTimeout(() => { 
                modal.style.display = 'none'; 
            }, 300);
        }
    },

    // 3. 切換 Tab
    switchTab: function(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (event && event.currentTarget) event.currentTarget.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const target = document.getElementById('tab-' + tabName);
        if (target) target.classList.add('active');
    },

    // 4. 檢查餘額
    checkBalanceForModal: function() {
        const currentBalance = this.state.currentUser?.credits || 0;
        const balanceEl = document.getElementById('modal-balance');
        if (balanceEl) balanceEl.innerText = currentBalance;
        
        const redeemBtn = document.getElementById('btn-redeem-container');
        const topupBtn = document.getElementById('btn-topup-container');
        
        if (currentBalance >= 230) {
            if (redeemBtn) redeemBtn.classList.remove('hidden');
            if (topupBtn) topupBtn.classList.add('hidden');
        } else {
            if (redeemBtn) redeemBtn.classList.add('hidden');
            if (topupBtn) topupBtn.classList.remove('hidden');
        }
    },

    // 5. 處理支付 (已美化彈窗)
    // ============================================
    // [修改版] 支付流程：Lemon Squeezy
    // ============================================
    // ============================================
    // [最終版] 支付邏輯：Lemon Squeezy (正式上線)
    // ============================================
    // ============================================
    // [最終版] 支付邏輯：Lemon Squeezy (含中文強制鎖定)
    // ============================================
    // ============================================
    // [極簡版] 支付邏輯：移除彈窗，直接跳轉
    // ============================================
    processPayment: async function(method) {
        // [Phase 1 修改] 試營運期間全面攔截支付請求
        // 防止用戶透過 Console 或修改 HTML 強制觸發
        await this.showCustomModal(
            '功能維護中 System Notice', 
            '試營運期間 (Soft Launch) 支付功能暫停。\n請使用優惠碼 [VIP888] 免費兌換報告。\n\nPayment is disabled during Soft Launch.', 
            false
        );
        return; 

        // --- 以下原代碼暫時保留，Phase 2 (推廣期) 刪除上方的攔截代碼即可恢復 ---
        /*
        const LEMON_SQUEEZY_URL = 'https://renoeasycalc.lemonsqueezy.com/checkout/buy/bd4d6c4f-98b6-4923-8125-b701fb354670?locale=en'; 

        if (method === 'cash') {
            window.open(LEMON_SQUEEZY_URL, '_self');
        } else if (method === 'points') {
            if ((this.state.currentUser?.credits || 0) < 230) {
                await this.showCustomModal('餘額不足', '點數不足，請使用單次購買。', false);
                return;
            }
            this.state.currentUser.credits -= 230;
            this.updateUserUI(); 
            localStorage.setItem('reno_user', JSON.stringify(this.state.currentUser));
            this.closePaymentModal();
            
            await this.showCustomModal('兌換成功', '🎉 扣點成功！正在生成報告...', false);
            this.generatePDFProcess(); 
        }
        */
    },
    // [新增] 檢查專案是否已解鎖，決定是下載還是跳出付費框
    handleExportRequest: function() {
        const project = this.state.projects[this.state.currentProjectIdx];
        
        // 1. 如果專案已經標記為「已付費 (is_paid)」，直接生成報告
        if (project.is_paid === true) {
            this.generatePDFProcess(); // 直接下載
        } else {
            // 2. 如果還沒付費，才打開付費視窗
            this.unlockPremium(); 
        }
    },
    // 6. 優惠碼 (已美化彈窗)
    // [修改] 優惠碼驗證邏輯
    redeemCode: async function() {
        const input = document.getElementById('promo-code-input');
        if (!input) return;
        const code = input.value.trim().toUpperCase();
        const project = this.state.projects[this.state.currentProjectIdx];

        if (code === 'VIP888') {
            // 1. 關閉視窗
            this.closePaymentModal();

            // 2. 【核心修改】將此專案標記為已付費
            project.is_paid = true;
            
            // 3. 【核心修改】立刻存檔到雲端 (這樣下次登入還會記得)
            // 這裡直接用 saveProjects() 就會把 is_paid 狀態一起存進 user_data 表
            await this.saveProjects();

            // 4. 顯示成功並下載
            await this.showCustomModal(
                '驗證成功 Success', 
                '🎉 專案已解鎖！您可以永久免費修改並下載此報告。', 
                false
            );
            
            this.generatePDFProcess(); 
        } else {
            await this.showCustomModal('驗證失敗 Invalid', '❌ 無效的優惠碼 (Invalid Code)', false);
        }
    },

    // 7. 充值彈窗 (已美化)
    showTopUpModal: async function() {
        await this.showCustomModal(
            '充值功能 Top-up', 
            '💰 點數充值功能即將上線！\n\n🔹 入門包：$500 (500點)\n🔹 專業包：$1000 (1000點)', 
            false
        );
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
    // ============================================
    // [雲端版] 讀取專案：優先讀雲端 -> 若雲端空則讀本地並同步
    // ============================================
    loadProjects: async function() {
        // 確保有登入
        const user = this.state.currentUser;
        if (!user || !user.id) return;

        console.log("正在從雲端下載專案...");

        try {
            // 1. 嘗試從 Supabase 下載
            const { data, error } = await supabaseClient
                .from('user_data')
                .select('projects_dump')
                .eq('user_id', user.id)
                .single();

            if (data && data.projects_dump) {
                // A. 雲端有資料 -> 使用雲端資料
                console.log("✅ 雲端同步成功");
                this.state.projects = data.projects_dump;
            } else {
                // B. 雲端沒資料 (第一次升級) -> 檢查本地舊資料
                console.log("☁️ 雲端無資料，檢查本地...");
                const localKey = 'reno_projects_' + user.phone;
                const localData = localStorage.getItem(localKey);
                
                if (localData) {
                    console.log("🔄 發現本地舊資料，正在遷移至雲端...");
                    this.state.projects = JSON.parse(localData);
                    // 立即執行一次雲端備份
                    this.saveProjects(); 
                } else {
                    this.state.projects = [];
                }
            }
            
            // 渲染畫面
            this.renderProjectList();

        } catch (err) {
            console.error("同步失敗:", err);
            alert("雲端同步發生錯誤，請檢查網絡");
        }
    },

    // ============================================
    // [雲端版] 儲存專案：將資料推送到 Supabase
    // ============================================
    saveProjects: async function() {
        const user = this.state.currentUser;
        if (!user || !user.id) return;
        
        // 介面提示 (可選)
        const statusEl = document.getElementById('workspace-status');
        if(statusEl) statusEl.innerText = 'Saving... ☁️';

        try {
            // 使用 upsert (有則更新，無則新增)
            const { error } = await supabaseClient
                .from('user_data')
                .upsert({ 
                    user_id: user.id, 
                    projects_dump: this.state.projects,
                    updated_at: new Date()
                });

            if (error) throw error;
            
            console.log("✅ 雲端存檔完成");
            if(statusEl) statusEl.innerText = 'Saved ✅';
            setTimeout(() => { if(statusEl) statusEl.innerText = '設計中 Editing...'; }, 2000);

        } catch (e) {
            console.error('雲端存檔失敗:', e);
            if(statusEl) statusEl.innerText = 'Save Failed ❌';
            // 斷網時的保底機制：還是存一份在本地
            const localKey = 'reno_projects_' + user.phone;
            localStorage.setItem(localKey, JSON.stringify(this.state.projects));
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
        document.getElementById('in-len').value = '20';
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
    // 在 app.js 中取代整個 calculateResult 函數
    // ============================================================
    //  [已修復] 核心計算邏輯：對接 Supabase Edge Function
    //  Fix: 解決了括號錯位及邏輯重複的問題，嚴格遵守 White Paper v2.0
    // ============================================================
    // ---------------------------------------------------------
    // 請將此段代碼貼在 deleteInput: function(idx) { ... }, 之後
    // ---------------------------------------------------------

    // [已修復] 核心計算邏輯：對接 Supabase Edge Function
    calculateResult: async function() {
        const project = this.state.projects[this.state.currentProjectIdx];
        
        if (!project || project.inputs.length === 0) {
            await this.showCustomModal("無法計算", "請先添加至少一個設備", false);
            return;
        }

        // UI 狀態鎖定
        const btn = document.querySelector('button[onclick="RenoApp.calculateResult()"]');
        let oldText = "開始核算 Generate Report";
        if(btn) {
            oldText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 雲端運算中...';
            btn.disabled = true;
        }

        try {
            console.log("正在呼叫雲端大腦...");
            
            // 呼叫 Supabase Edge Function
            const { data, error } = await supabaseClient.functions.invoke('calculate-project', {
                body: { inputs: project.inputs }
            });

            if (error) throw new Error(error.message || "雲端連線失敗");
            if (!data || !data.totalKva) throw new Error("回傳數據異常");

            console.log("計算成功:", data);
            
            // 保存結果
            project.result = data;
            this.saveProjects();
            this.renderResultTable();

            // 成功提示
            await this.showCustomModal(
                "計算成功 Success", 
                `雲端核算完成！\n總需量: ${data.totalKva} kVA\n建議電錶: ${data.meter}`, 
                false
            );

        } catch (err) {
            console.error("Calculation Failed:", err);
            await this.showCustomModal("系統錯誤 Error", "計算失敗: " + (err.message || String(err)), false);
        } finally {
            if(btn) {
                btn.innerHTML = oldText;
                btn.disabled = false;
            }
        }
    }, // <--- 注意這裡必須要有逗號

    // [UI] 渲染結果表格
    renderResultTable: function() {
        const project = this.state.projects[this.state.currentProjectIdx];
        if (!project || !project.result) return;

        const result = project.result;
        
        // 更新摘要
        const demandEl = document.getElementById('res-demand');
        const meterEl = document.getElementById('res-meter');
        if(demandEl) demandEl.textContent = result.totalKva.toFixed(2) + ' kVA';
        if(meterEl) meterEl.textContent = result.meter;

        // 更新表格行
        const previewRows = document.getElementById('result-preview-rows');
        if(previewRows) {
            previewRows.innerHTML = result.rows.map(r => {
                const isHighCurrentSinglePhase = !r.is3Phase && r.breaker >= 40;
                const breakerClass = isHighCurrentSinglePhase ? 'text-danger' : '';
                const warningIcon = isHighCurrentSinglePhase ? '<i class="fas fa-exclamation-circle"></i> ' : '';
                const vdClass = r.vd > 4 ? 'text-danger' : 'text-success';

                return `
                <div class="preview-table-row blur-text" style="grid-template-columns: 0.6fr 2.2fr 0.7fr 0.8fr 1.2fr 0.9fr 0.8fr 1.1fr 0.7fr;">
                    <div>${r.circuitNo}</div>
                    <div style="justify-content:flex-start;">${r.name.split('\n')[0]}</div>
                    <div>${r.assignedPhase}</div>
                    <div class="${breakerClass}">${warningIcon}${r.breaker}A</div>
                    <div style="font-size:0.9em;">${r.protectionType}</div>
                    <div>${r.cable}</div>
                    <div class="${vdClass}">${r.vd.toFixed(2)}%</div>
                    <div>${r.Pinst.toFixed(2)}</div>
                    <div>${r.df.toFixed(2)}</div>
                </div>`;
            }).join('');
        }

        // 更新警告框
        const warningEl = document.getElementById('res-warning');
        if(warningEl) {
            if (result.totalKva >= 69) warningEl.classList.remove('hidden');
            else warningEl.classList.add('hidden');
        }

        this.showPage('page-result');
    }, // <--- 逗號

    // 輔助圖片加載
    loadImage: function(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => { console.warn('Logo missing'); resolve(null); };
            img.src = src;
        });
    },


    addPageNumbers: function(doc) {
        const totalPages = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(10); 
        doc.setTextColor(100);
        
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            doc.text('Powered by RenoEasy', 10, pageHeight - 10, { align: 'left' });
        }
    }, // <--- 逗號

    // =========================================================================
    // [已修復] PDF 表格生成器 (文字修正 + 版面優化)
    // =========================================================================
    generateReportTableOnly: function(project, result, logoImg) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const WIDTH = 3508; // A4 300dpi
            const rowCount = result.rows.length;
            
            // [Layout Fix] 微調高度計算，確保底部有緩衝
            const headerHeight = 520;
            // [Layout Fix] 將單行高度從 120 減至 110，累積起來可讓表格「提早」結束，避免撞頁尾
            const rowH = 110; 
            const bodyHeight = rowCount * rowH; // 使用新的行高
            const HEIGHT = headerHeight + bodyHeight + 100; // 底部增加 100px 緩衝
            
            canvas.width = WIDTH; canvas.height = HEIGHT;
            
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
            
            const fontTitle = 'bold 60px "Noto Sans TC", sans-serif';
            const fontHeader = 'bold 32px "Noto Sans TC", sans-serif';
            const fontBody = '30px "Noto Sans TC", sans-serif';
            const fontProjectDate = 'bold 45px "Noto Sans TC", sans-serif';
            
            // 1. 標題區
            let titleX = 450;
            ctx.fillStyle = '#000'; ctx.font = fontTitle; ctx.textAlign = 'left';
            ctx.fillText('配電箱負載計算表 / Electrical Load Schedule', titleX, 150);
            
            ctx.font = fontProjectDate;
            ctx.fillText(`Project: ${project.name}`, titleX, 230);
            ctx.fillText(`Date: ${new Date().toLocaleDateString('zh-HK')}`, titleX, 290);
            
            // 2. 右上角資訊框 (Info Box) - [Text Fix] 文字修正
            const infoBoxWidth = 1400; const infoBoxX = WIDTH - infoBoxWidth - 50; const infoBoxY = 80;
            ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(infoBoxX, infoBoxY, infoBoxWidth, 250);
            
            const labelX = infoBoxX + 40; const valueX = infoBoxX + 900;
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            
            // [Fix 1.1] Main Switch Rating 主開關選型
            ctx.fillText('Main Switch Rating (主開關選型):', labelX, infoBoxY + 60);
            ctx.font = '34px "Noto Sans TC", sans-serif'; ctx.fillText(result.mainSwitch, valueX, infoBoxY + 60);
            
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            // [Fix 1.2] Contract Power - Palim. 電錶功率
            ctx.fillText('Contract Power - Palim. (電錶功率):', labelX, infoBoxY + 140);
            ctx.font = '34px "Noto Sans TC", sans-serif'; ctx.fillText(result.meter, valueX, infoBoxY + 140);
            
            ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
            // [Fix 1.3] CEM Service Breaker 澳電引入線斷路器
            ctx.fillText('CEM Service Breaker (澳電引入線斷路器):', labelX, infoBoxY + 220);
            ctx.font = '34px "Noto Sans TC", sans-serif'; ctx.fillText(result.serviceBreaker, valueX, infoBoxY + 220);
            
            // 3. 表格繪製
            const startX = 100; const startY = 400; const tableWidth = WIDTH - 200;
            // rowH 已在上方定義為 110
            
            // [Text Fix] 表格欄位名稱修正
            const cols = [
                { name: 'Circuit No.\n迴路編號', w: 0.09 }, 
                { name: 'Description\n用途', w: 0.20 },
                { name: 'Phase\n相位', w: 0.07 },
                { name: 'Breaker\n保護器', w: 0.09 }, 
                { name: 'Protection Type\n保護類型', w: 0.14 }, 
                // [Fix 1.6] Cable Size 線徑(mm²)(L/N/E)
                { name: 'Cable Size\n線徑(mm²)(L/N/E)', w: 0.11 },
                { name: 'Voltage Drop\n電壓降', w: 0.09 }, 
                // [Fix 1.4] Installed Power Pinst 安裝功率(kVA)
                { name: 'Installed Power\nPinst 安裝功率(kVA)', w: 0.12 }, 
                // [Fix 1.5] Diversity Factor 同時系數
                { name: 'Diversity Factor\n同時系數', w: 0.09 }
            ];
            
            const colX = []; let currentX = startX;
            cols.forEach(c => { colX.push({ x: currentX, width: c.w * tableWidth, name: c.name }); currentX += c.w * tableWidth; });
            
            // 表頭背景
            ctx.fillStyle = '#0044cc'; ctx.fillRect(startX, startY, tableWidth, rowH);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(startX, startY, tableWidth, rowH);
            
            // 表頭文字
            ctx.fillStyle = '#fff'; ctx.font = fontHeader; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            colX.forEach((c, i) => {
                if (i > 0) { ctx.beginPath(); ctx.moveTo(c.x, startY); ctx.lineTo(c.x, startY + rowH); ctx.stroke(); }
                const lines = c.name.split('\n');
                lines.forEach((line, li) => { 
                    const yOffset = (li - (lines.length-1)/2) * 40; 
                    ctx.fillText(line, c.x + c.width/2, startY + rowH/2 + yOffset); 
                });
            });
            
            // 表格內容
            let currentY = startY + rowH; const cellH = rowH - 10; // 內容格也稍微縮減
            ctx.font = fontBody; ctx.fillStyle = '#000';
            
            result.rows.forEach(row => {
                ctx.strokeRect(startX, currentY, tableWidth, cellH);
                const data = [
                    row.circuitNo, row.name, row.assignedPhase, row.breaker+'A', 
                    row.protectionType, row.cable, row.vd.toFixed(2)+'%', 
                    row.Pinst.toFixed(2), row.df.toFixed(2)
                ];
                
                colX.forEach((c, i) => {
                    if (i > 0) { ctx.beginPath(); ctx.moveTo(c.x, currentY); ctx.lineTo(c.x, currentY + cellH); ctx.stroke(); }
                    const strVal = String(data[i]);
                    if (strVal.includes('\n')) {
                        const lines = strVal.split('\n');
                        const lineHeight = 35;
                        const startTxtY = currentY + cellH/2 - ((lines.length - 1) * lineHeight / 2);
                        lines.forEach((line, li) => { ctx.fillText(line, c.x + c.width/2, startTxtY + (li * lineHeight)); });
                    } else { 
                        ctx.fillText(strVal, c.x + c.width/2, currentY + cellH/2); 
                    }
                });
                currentY += cellH;
            });
            resolve(canvas);
        });
    },

    // =========================================================================
    // [已修復] 摘要區塊 (文字修正)
    // =========================================================================
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
            
            // [Fix 1.7] Sum. Demand Psim 最高總需量
            ctx.fillText(`Sum. Demand Psim 最高總需量: ${result.totalKva.toFixed(2)} kVA`, 0, startY);
            
            ctx.font = fontFooterMed;
            ctx.fillText(`Phase Balance 三相平衡: L1: ${result.phaseBalance.L1} | L2: ${result.phaseBalance.L2} | L3: ${result.phaseBalance.L3}`, 0, startY + 80);
            
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
}, // <--- 改成逗號，讓物件繼續延伸
// }; <--- 刪除這一行 (不要在這裡結束物件)
    // ============================================
    // [新增] 用戶資料與點數系統 (User Profile & Credits)
    // ============================================

    // 1. 從 Supabase 抓取用戶點數
    fetchUserProfile: async function(user) {
        if (!user || !user.id) return;

        try {
            // 從 profiles 表查詢 (假設欄位: id, credits)
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('credits')
                .eq('id', user.id)
                .single();

            // 如果剛註冊還沒有 profile，data 可能為空，預設給 0 點
            const credits = data ? data.credits : 0;

            // 更新本地狀態
            if (this.state.currentUser) {
                this.state.currentUser.credits = credits;
                // 更新 LocalStorage 以便刷新頁面後還在
                localStorage.setItem('reno_user', JSON.stringify(this.state.currentUser));
            }

            // 更新 UI
            this.updateUserUI();

        } catch (err) {
            console.error('Profile fetch error:', err);
        }
    },

    // 2. 更新右上角 UI (顯示 Email 和 點數)
    updateUserUI: function() {
        const user = this.state.currentUser;
        if (!user) return;

        // 更新電話/Email顯示
        const userLabel = document.getElementById('app-user-phone');
        if (userLabel) userLabel.innerText = user.phone || 'User';

        // 更新點數徽章
        const creditsLabel = document.getElementById('user-credits');
        if (creditsLabel) {
            // 如果 credits 未定義，顯示 0
            creditsLabel.innerText = (user.credits !== undefined) ? user.credits : 0;
        }
    },

    // ============================================
    // [補回] PDF 生成核心 (PDF Generator)
    // ============================================
    generatePDFProcess: async function() {
        try {
            // 1. 獲取當前專案數據
            const project = this.state.projects[this.state.currentProjectIdx];
            const result = project.result;
            
            if (!result) {
                await this.showCustomModal("數據缺失", "請先進行計算 (Calculate) 再下載報告。", false);
                return;
            }

            // 2. 顯示加載中
            const btn = document.querySelector('.btn-premium'); 
            if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';

            // 3. 準備素材
            const logoImg = await this.loadImage('LOGO.png');
            
            // 生成表格 (Canvas)
            const tableCanvas = await this.generateReportTableOnly(project, result, logoImg);
            const tableImgData = tableCanvas.toDataURL('image/png');
            
            // 生成摘要 (Canvas)
            const summaryCanvas = await this.generateSummaryBlock(result);
            const summaryImgData = summaryCanvas.toDataURL('image/png');
            
            // 生成圓餅圖 (Canvas)
            const chartCanvas = await this.createPhaseBalanceChart(result.phaseBalance);
            const chartImgData = chartCanvas.toDataURL('image/png');

            // 4. 組合 PDF (jsPDF)
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); // 橫向 A4
            const PAGE_WIDTH = 297; 
            const PAGE_HEIGHT = 210; 
            const MARGIN = 10;
            
            // 計算表格在 PDF 中的高度 (保持比例)
            const tableHeightInPDF = tableCanvas.height * (PAGE_WIDTH / tableCanvas.width);
            
            // 貼上表格 (從 (0,0) 開始，滿版寬度)
            doc.addImage(tableImgData, 'PNG', 0, 0, PAGE_WIDTH, tableHeightInPDF);
            
            // 檢查是否需要換頁 (如果表格太長)
            const FOOTER_HEIGHT = 60;
            let currentY = tableHeightInPDF + 5;
            
            if (currentY + FOOTER_HEIGHT > (PAGE_HEIGHT - MARGIN)) { 
                doc.addPage(); 
                currentY = 20; 
            }
            
            // 貼上摘要與圖表
            doc.addImage(summaryImgData, 'PNG', MARGIN, currentY, 200, 40);
            doc.addImage(chartImgData, 'PNG', 220, currentY - 5, 60, 45);
            
            // 加入頁碼
            this.addPageNumbers(doc);
            
            // 5. 下載檔案
            doc.save(`RenoEasy_${project.name}.pdf`);
            
            // 6. 成功提示
            if(btn) btn.innerHTML = '立即購買 Purchase Now';
            // 這裡不需要再彈窗，因為瀏覽器會自動下載檔案

        } catch (e) {
            console.error(e);
            await this.showCustomModal("生成失敗 Error", "PDF 生成過程中發生錯誤: " + e.message, false);
        }
    },

    
}; // <--- 在這裡補上 RenoApp 的結束括號

window.onload = () => RenoApp.init();

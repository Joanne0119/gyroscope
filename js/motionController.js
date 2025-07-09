class MotionController {
    constructor(config = {}) {
        // 可配置的設定
        this.config = {
            movementThreshold: config.movementThreshold || 20,
            calibrationTime: config.calibrationTime || 1000,
            smoothingFactor: config.smoothingFactor || 0.3,
            deadZone: config.deadZone || 5,
            maxThreshold: config.maxThreshold || 60,
            enableAudio: config.enableAudio !== false,
            enableVibration: config.enableVibration !== false,
            autoCalibrate: config.autoCalibrate || false,
            debugMode: config.debugMode || false,
            ...config
        };

        // 平台資訊
        this.platform = this.detectPlatform();

        // 狀態管理
        this.state = {
            isCalibrated: false,
            isActive: false,
            currentDirection: '靜止',
            lastDirection: '靜止',
            calibration: { alpha: 0, beta: 0, gamma: 0 },
            current: { alpha: 0, beta: 0, gamma: 0 },
            smoothed: { alpha: 0, beta: 0, gamma: 0 },
            rawHistory: [],
            calibrationBuffer: []
        };

        // 權限狀態
        this.permissions = {
            orientation: 'unknown',
            motion: 'unknown',
            platform: this.platform
        };

        // 音效系統
        this.audioContext = null;
        this.audioEnabled = false;

        // 回調函式
        this.callbacks = {
            onDirectionChange: null,
            onCalibrationComplete: null,
            onSensorData: null,
            onError: null
        };

        // 綁定方法
        this.handleOrientation = this.handleOrientation.bind(this);
        this.handleMotion = this.handleMotion.bind(this);
        
        this.log(`MotionController 初始化，檢測到平台: ${this.platform}`);
    }

    // === 初始化與權限管理 ===
    async init() {
        try {
            await this.requestPermissions();
            this.setupAudio();
            this.setupEventListeners();
            this.state.isActive = true;
            
            if (this.config.autoCalibrate) {
                await this.autoCalibrate();
            }
            
            this.log('MotionController initialized successfully');
            return true;
        } catch (error) {
            this.handleError('初始化失敗', error);
            return false;
        }
    }

    async requestPermissions() {
        const results = {
            orientation: 'unknown',
            motion: 'unknown',
            platform: this.platform
        };

        try {
            // 檢測設備類型
            this.log('檢測到的平台:', results.platform);

            // iOS 13+ 權限請求
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                this.log('iOS 13+ 檢測到，請求方向感應權限...');
                
                const orientationPermission = await DeviceOrientationEvent.requestPermission();
                results.orientation = orientationPermission;
                
                if (orientationPermission !== 'granted') {
                    throw new Error('需要陀螺儀權限才能使用體感控制');
                }
                
                this.log('方向感應權限已獲得');
            } else {
                // Android 和其他設備
                this.log('非 iOS 13+ 設備，檢查感應器可用性...');
                
                // 檢查是否支援 DeviceOrientationEvent
                if (window.DeviceOrientationEvent) {
                    results.orientation = 'granted';
                    this.log('設備支援方向感應');
                } else {
                    results.orientation = 'denied';
                    throw new Error('此設備不支援方向感應器');
                }
            }

            // 動作感應權限 (iOS 13+)
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                this.log('請求動作感應權限...');
                
                const motionPermission = await DeviceMotionEvent.requestPermission();
                results.motion = motionPermission;
                
                if (motionPermission !== 'granted') {
                    this.log('動作感應權限未獲得，將只使用方向感應');
                } else {
                    this.log('動作感應權限已獲得');
                }
            } else {
                // 檢查是否支援 DeviceMotionEvent
                if (window.DeviceMotionEvent) {
                    results.motion = 'granted';
                    this.log('設備支援動作感應');
                } else {
                    results.motion = 'denied';
                    this.log('設備不支援動作感應');
                }
            }

            // 更新權限狀態
            this.permissions = results;

            // 額外的兼容性檢查
            await this.performCompatibilityCheck();
            
            this.log('權限請求完成:', results);
            return results;

        } catch (error) {
            this.log('權限請求失敗:', error);
            throw error;
        }
    }

    // 檢測平台
    detectPlatform() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        
        this.log('User Agent:', userAgent);
        this.log('Platform:', platform);
        
        // 優先使用 navigator.platform（較不容易被開發者工具模擬）
        if (platform) {
            if (/iPhone|iPad|iPod/i.test(platform)) {
                return 'iOS';
            } else if (/MacIntel|Mac68K|MacPPC/i.test(platform)) {
                return 'macOS';
            } else if (/Win/i.test(platform)) {
                return 'Windows';
            } else if (/Linux/i.test(platform)) {
                // 進一步區分 Linux 和 Android
                if (/Android/i.test(userAgent)) {
                    return 'Android';
                }
                return 'Linux';
            }
        }
        
        // 備用方案：使用 userAgent
        if (/iPhone|iPad|iPod/i.test(userAgent)) {
            return 'iOS';
        } else if (/Macintosh|Mac OS X|MacIntel/i.test(userAgent)) {
            return 'macOS';
        } else if (/Android/i.test(userAgent)) {
            return 'Android';
        } else if (/Windows NT|Windows/i.test(userAgent)) {
            return 'Windows';
        } else if (/Linux/i.test(userAgent)) {
            return 'Linux';
        }
        
        return 'Unknown';
    }

    // 兼容性檢查
    async performCompatibilityCheck() {
        return new Promise((resolve) => {
            let orientationReceived = false;
            let motionReceived = false;
            
            // 設定測試監聽器
            const testOrientation = (event) => {
                if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
                    orientationReceived = true;
                    this.log('方向感應器測試成功');
                }
            };
            
            const testMotion = (event) => {
                if (event.acceleration || event.accelerationIncludingGravity) {
                    motionReceived = true;
                    this.log('動作感應器測試成功');
                }
            };
            
            // 添加測試監聽器
            window.addEventListener('deviceorientation', testOrientation);
            window.addEventListener('devicemotion', testMotion);
            
            // 2秒後檢查結果
            setTimeout(() => {
                window.removeEventListener('deviceorientation', testOrientation);
                window.removeEventListener('devicemotion', testMotion);
                
                if (!orientationReceived) {
                    this.log('警告: 方向感應器可能無法正常工作');
                }
                
                if (!motionReceived) {
                    this.log('警告: 動作感應器可能無法正常工作');
                }
                
                resolve({
                    orientationWorking: orientationReceived,
                    motionWorking: motionReceived
                });
            }, 2000);
        });
    }

    // 提供更詳細的錯誤訊息
    getPermissionErrorMessage(platform, error) {
        const messages = {
            'iOS': {
                'denied': '請到「設定 > Safari > 動態與方向」中啟用動態與方向存取',
                'blocked': '感應器權限已被阻止，請重新載入頁面並允許權限'
            },
            'Android': {
                'denied': '請確認瀏覽器支援設備感應器，並嘗試使用 Chrome 瀏覽器',
                'blocked': '請檢查瀏覽器設定中的感應器權限'
            },
            'Unknown': {
                'denied': '此設備可能不支援體感控制功能',
                'blocked': '請使用支援設備感應器的行動設備'
            }
        };

        return messages[platform] || messages['Unknown'];
    }

    setupAudio() {
        if (!this.config.enableAudio) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioEnabled = true;
            this.log(`音效系統初始化成功 (${this.platform})`);
        } catch (error) {
            this.log('音效初始化失敗:', error);
        }
    }

    setupEventListeners() {
        // 方向感應
        window.addEventListener('deviceorientation', this.handleOrientation);
        
        // 動作感應（如果支援）
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', this.handleMotion);
        }

        // 頁面可見性變化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
        
        this.log(`事件監聽器設定完成 (${this.platform})`);
    }

    // === 校正系統 ===
    async calibrate() {
        return new Promise((resolve, reject) => {
            this.state.calibrationBuffer = [];
            this.log('開始校正，請保持手機靜止...');
            
            const startTime = Date.now();
            const collectData = () => {
                if (Date.now() - startTime > this.config.calibrationTime) {
                    this.completeCalibration();
                    resolve(this.state.calibration);
                } else {
                    requestAnimationFrame(collectData);
                }
            };
            
            collectData();
        });
    }

    async autoCalibrate() {
        // 自動校正：等待感應器穩定
        await this.waitForStable();
        return this.calibrate();
    }

    async waitForStable(timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let stableCount = 0;
            const requiredStableCount = 10;
            
            const checkStable = () => {
                if (Date.now() - startTime > timeout) {
                    resolve();
                    return;
                }
                
                if (this.isCurrentStateStable()) {
                    stableCount++;
                    if (stableCount >= requiredStableCount) {
                        resolve();
                        return;
                    }
                } else {
                    stableCount = 0;
                }
                
                setTimeout(checkStable, 100);
            };
            
            checkStable();
        });
    }

    isCurrentStateStable() {
        if (this.state.rawHistory.length < 5) return false;
        
        const recent = this.state.rawHistory.slice(-5);
        const avgAlpha = recent.reduce((sum, item) => sum + item.alpha, 0) / recent.length;
        const avgBeta = recent.reduce((sum, item) => sum + item.beta, 0) / recent.length;
        
        return recent.every(item => 
            Math.abs(item.alpha - avgAlpha) < 2 && 
            Math.abs(item.beta - avgBeta) < 2
        );
    }

    completeCalibration() {
        if (this.state.calibrationBuffer.length === 0) return;
        
        // 計算平均值作為校正基準
        const sum = this.state.calibrationBuffer.reduce((acc, item) => ({
            alpha: acc.alpha + item.alpha,
            beta: acc.beta + item.beta,
            gamma: acc.gamma + item.gamma
        }), { alpha: 0, beta: 0, gamma: 0 });
        
        const count = this.state.calibrationBuffer.length;
        this.state.calibration = {
            alpha: sum.alpha / count,
            beta: sum.beta / count,
            gamma: sum.gamma / count
        };
        
        this.state.isCalibrated = true;
        this.log('校正完成:', this.state.calibration);
        
        if (this.callbacks.onCalibrationComplete) {
            this.callbacks.onCalibrationComplete(this.state.calibration);
        }
    }

    // === 感應器數據處理 ===
    handleOrientation(event) {
        if (!this.state.isActive) return;
        
        const { alpha, beta, gamma } = event;
        if (alpha === null || beta === null || gamma === null) return;
        
        // 更新原始數據
        this.state.current = { alpha, beta, gamma };
        
        // 記錄歷史數據
        this.addToHistory(this.state.current);
        
        // 校正過程中收集數據
        if (!this.state.isCalibrated && this.state.calibrationBuffer.length < 100) {
            this.state.calibrationBuffer.push({ alpha, beta, gamma });
        }
        
        // 平滑處理
        this.applySmoothingFilter();
        
        // 計算相對變化
        if (this.state.isCalibrated) {
            this.updateMovementDirection();
        }
        
        // 觸發數據回調
        if (this.callbacks.onSensorData) {
            this.callbacks.onSensorData({
                raw: this.state.current,
                smoothed: this.state.smoothed,
                calibration: this.state.calibration
            });
        }
    }

    handleMotion(event) {
        if (!this.state.isActive) return;
        
        const acceleration = event.acceleration;
        if (acceleration) {
            // 可以在這裡添加震動/搖晃偵測
            const intensity = Math.sqrt(
                acceleration.x ** 2 + 
                acceleration.y ** 2 + 
                acceleration.z ** 2
            );
            
            // 檢測劇烈搖晃
            if (intensity > 15) {
                this.handleShakeGesture(intensity);
            }
        }
    }

    addToHistory(data) {
        this.state.rawHistory.push(data);
        if (this.state.rawHistory.length > 50) {
            this.state.rawHistory.shift();
        }
    }

    applySmoothingFilter() {
        const factor = this.config.smoothingFactor;
        
        if (this.state.rawHistory.length === 1) {
            this.state.smoothed = { ...this.state.current };
        } else {
            this.state.smoothed = {
                alpha: this.state.smoothed.alpha * (1 - factor) + this.state.current.alpha * factor,
                beta: this.state.smoothed.beta * (1 - factor) + this.state.current.beta * factor,
                gamma: this.state.smoothed.gamma * (1 - factor) + this.state.current.gamma * factor
            };
        }
    }

    // === 方向判斷系統 ===
    updateMovementDirection() {
        const { alpha, beta } = this.calculateRelativeMovement();
        const direction = this.determineDirection(alpha, beta);
        
        if (direction !== this.state.currentDirection) {
            this.state.lastDirection = this.state.currentDirection;
            this.state.currentDirection = direction;
            
            // 觸發方向變化回調
            if (this.callbacks.onDirectionChange) {
                this.callbacks.onDirectionChange(direction, this.state.lastDirection);
            }
            
            // 播放音效
            this.playFeedbackSound(direction);
            
            // 觸發震動
            this.triggerVibration(direction);
        }
    }

    calculateRelativeMovement() {
        const deltaAlpha = this.normalizeAngle(
            this.state.smoothed.alpha - this.state.calibration.alpha
        );
        const deltaBeta = this.state.smoothed.beta - this.state.calibration.beta;
        
        return { alpha: deltaAlpha, beta: deltaBeta };
    }

    determineDirection(alpha, beta) {
        const absAlpha = Math.abs(alpha);
        const absBeta = Math.abs(beta);
        
        // 死區處理
        if (absAlpha < this.config.deadZone && absBeta < this.config.deadZone) {
            return '靜止';
        }
        
        // // 防止過度敏感
        // if (absAlpha > this.config.maxThreshold || absBeta > this.config.maxThreshold) {
        //     return '動作過大';
        // }
        
        // 判斷主要方向
        if (absBeta > absAlpha) {
            if (beta > this.config.movementThreshold) return '往上';
            if (beta < -this.config.movementThreshold) return '往下';
        } else {
            if (alpha < -this.config.movementThreshold) return '往右';
            if (alpha > this.config.movementThreshold) return '往左';
        }
        
        return '靜止';
    }

    normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    // === 反饋系統 ===
    playFeedbackSound(direction) {
        if (!this.audioEnabled || !this.config.enableAudio) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const panner = this.audioContext.createStereoPanner();
            
            oscillator.connect(panner);
            panner.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            const soundConfig = this.getSoundConfig(direction);
            oscillator.frequency.value = soundConfig.frequency;
            oscillator.type = soundConfig.type;
            gainNode.gain.value = soundConfig.volume;
            panner.pan.value = soundConfig.pan;
            
            const now = this.audioContext.currentTime;
            oscillator.start(now);
            gainNode.gain.linearRampToValueAtTime(0, now + soundConfig.duration);
            oscillator.stop(now + soundConfig.duration);
            
        } catch (error) {
            this.log('音效播放失敗:', error);
        }
    }

    getSoundConfig(direction) {
        const configs = {
            '往上': { frequency: 800, type: 'sine', volume: 0.3, pan: 0, duration: 0.1 },
            '往下': { frequency: 400, type: 'sine', volume: 0.3, pan: 0, duration: 0.1 },
            '往左': { frequency: 600, type: 'sine', volume: 0.3, pan: -1, duration: 0.1 },
            '往右': { frequency: 600, type: 'sine', volume: 0.3, pan: 1, duration: 0.1 },
            '靜止': { frequency: 200, type: 'sine', volume: 0.15, pan: 0, duration: 0.05 },
            '動作過大': { frequency: 150, type: 'square', volume: 0.2, pan: 0, duration: 0.2 }
        };
        
        return configs[direction] || configs['靜止'];
    }

    triggerVibration(direction) {
        if (!this.config.enableVibration || !navigator.vibrate) return;
        
        const patterns = {
            '往上': [50],
            '往下': [50],
            '往左': [30, 30, 30],
            '往右': [30, 30, 30],
            '靜止': [20],
            '動作過大': [100, 50, 100]
        };
        
        const pattern = patterns[direction] || [20];
        navigator.vibrate(pattern);
    }

    // === 手勢識別 ===
    handleShakeGesture(intensity) {
        if (this.callbacks.onShakeDetected) {
            this.callbacks.onShakeDetected(intensity);
        }
    }

    // === 狀態控制 ===
    pause() {
        this.state.isActive = false;
    }

    resume() {
        this.state.isActive = true;
    }

    reset() {
        this.state.isCalibrated = false;
        this.state.currentDirection = '靜止';
        this.state.lastDirection = '靜止';
        this.state.calibration = { alpha: 0, beta: 0, gamma: 0 };
        this.state.rawHistory = [];
        this.state.calibrationBuffer = [];
    }

    destroy() {
        window.removeEventListener('deviceorientation', this.handleOrientation);
        window.removeEventListener('devicemotion', this.handleMotion);
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.state.isActive = false;
    }

    // === 配置與回調 ===
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    on(event, callback) {
        if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase() + event.slice(1)}`)) {
            this.callbacks[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] = callback;
        }
    }

    // === 工具函式 ===
    log(...args) {
        if (this.config.debugMode) {
            console.log('[MotionController]', ...args);
        }
    }

    handleError(message, error) {
        this.log('錯誤:', message, error);
        if (this.callbacks.onError) {
            this.callbacks.onError(message, error);
        }
    }

    // === 取得狀態 ===
    getState() {
        return { ...this.state };
    }

    getCurrentDirection() {
        return this.state.currentDirection;
    }

    isCalibrated() {
        return this.state.isCalibrated;
    }

    getCalibration() {
        return { ...this.state.calibration };
    }

    // === 新增：取得平台和權限資訊 ===
    getPlatform() {
        return this.platform;
    }

    getPermissions() {
        return { ...this.permissions };
    }

    // === 新增：平台相關的配置調整 ===
    applyPlatformSpecificConfig() {
        switch (this.platform) {
            case 'iOS':
                // iOS 設備通常需要較低的閾值
                this.config.movementThreshold = Math.min(this.config.movementThreshold, 15);
                this.config.deadZone = Math.max(this.config.deadZone, 3);
                break;
            case 'Android':
                // Android 設備可能需要較高的閾值
                this.config.movementThreshold = Math.max(this.config.movementThreshold, 25);
                this.config.deadZone = Math.max(this.config.deadZone, 8);
                break;
            default:
                // 保持預設值
                break;
        }
        
        this.log(`已套用 ${this.platform} 平台專用配置`);
    }

    // === 新增：檢查平台兼容性 ===
    isPlatformSupported() {
        const supportedPlatforms = ['iOS', 'Android'];
        return supportedPlatforms.includes(this.platform);
    }

    // === 新增：取得平台相關的使用說明 ===
    getPlatformInstructions() {
        const instructions = {
            'iOS': {
                setup: '請確保在 Safari 中開啟「動態與方向」權限',
                calibration: '將 iPhone 平放在桌面上進行校正',
                usage: '輕輕傾斜 iPhone 來控制方向'
            },
            'Android': {
                setup: '建議使用 Chrome 瀏覽器以獲得最佳體驗',
                calibration: '將手機平放並保持靜止進行校正',
                usage: '輕輕傾斜手機來控制方向'
            },
            'Unknown': {
                setup: '請使用支援體感功能的行動設備',
                calibration: '將設備平放進行校正',
                usage: '傾斜設備來控制方向'
            }
        };
        
        return instructions[this.platform] || instructions['Unknown'];
    }
}

export default MotionController;
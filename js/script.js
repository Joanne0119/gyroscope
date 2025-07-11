import MotionController from './motionController.js';
// --- 元素宣告 ---
const permissionButton = document.getElementById('permission-button');
const calibrateButton = document.getElementById('calibrate-button');
const rawDataElem = document.getElementById('raw-data');
const calibrationDataElem = document.getElementById('calibration-data');
const directionDisplayElem = document.getElementById('direction-display');
const permissionInfoElem = document.getElementById('permission-info');
const coordinateDisplayElem = document.getElementById('coordinate-display');

// --- 創建 MotionController 實例 ---
const motionController = new MotionController({
    movementThreshold: 20,        // 與原本的 MOVEMENT_THRESHOLD 相同
    enableAudio: true,            // 啟用音效
    enableVibration: true,        // 啟用震動
    debugMode: true,              // 開啟除錯模式
    autoCalibrate: false,         // 手動校正
    calibrationTime: 1000,        // 校正時間 1 秒
    smoothingFactor: 0.3,         // 平滑處理
    deadZone: 5,                  // 死區設定
    maxThreshold: 60              // 最大閾值
});

// --- 設定 MotionController 回調函式 ---

// 方向變化回調
motionController.on('directionChange', (direction, lastDirection) => {
    console.log(`方向變化: ${lastDirection} → ${direction}`);
    
    // 更新顯示
    directionDisplayElem.textContent = direction;
    
    // 可以在這裡添加額外的視覺效果
    directionDisplayElem.className = direction !== '靜止' ? 'direction-active' : '';
});

motionController.on('coordinateChange', (coords) => {
    console.log(`目前座標: X=${coords.x.toFixed(2)}, Y=${coords.y.toFixed(2)}`);
    
    coordinateDisplayElem.textContent = `(${coords.x.toFixed(2)}, ${coords.y.toFixed(2)})`;
});

// 校正完成回調
motionController.on('calibrationComplete', (calibration) => {
    console.log('校正完成:', calibration);
    
    // 更新校正基準顯示
    calibrationDataElem.innerHTML = `Alpha: ${calibration.alpha.toFixed(1)}, Beta: ${calibration.beta.toFixed(1)}, Gamma: ${calibration.gamma.toFixed(1)}`;
    
    // 更新校正按鈕狀態
    calibrateButton.textContent = '重新校正';
    calibrateButton.disabled = false;
});

// 感應器數據回調
motionController.on('sensorData', (data) => {
    // 更新原始數據顯示
    rawDataElem.innerHTML = `Alpha: ${data.raw.alpha.toFixed(1)}, Beta: ${data.raw.beta.toFixed(1)}, Gamma: ${data.raw.gamma.toFixed(1)}`;
});

// 錯誤處理回調
motionController.on('error', (message, error) => {
    console.error('Motion Controller 錯誤:', message, error);
    
    // 顯示錯誤訊息給使用者
    alert(`感應器錯誤: ${message}`);
});

// 搖晃偵測回調（可選）
motionController.on('shakeDetected', (intensity) => {
    console.log('偵測到搖晃:', intensity);
    
    // 可以在這裡添加搖晃相關的功能
    directionDisplayElem.textContent = '搖晃中!';
    setTimeout(() => {
        directionDisplayElem.textContent = motionController.getCurrentDirection();
    }, 500);
});

// --- 權限請求事件 ---
permissionButton.addEventListener('click', async function() {
    try {
        // 初始化 MotionController
        const success = await motionController.init();

        if (success) {
            this.textContent = '感應器已啟用';
            this.disabled = true;
            
            // 啟用校正按鈕
            calibrateButton.disabled = false;
            
            console.log('MotionController 初始化成功');
        } else {
            this.textContent = '初始化失敗';
            console.error('MotionController 初始化失敗');
        }
    } catch (error) {
        console.error('權限請求失敗:', error);
        this.textContent = '權限被拒絕';
    }
});

// --- 校正事件 ---
calibrateButton.addEventListener('click', async function() {
    try {
        this.textContent = '校正中...';
        this.disabled = true;
        
        // 執行校正
        await motionController.calibrate();
        
        console.log('校正完成');
    } catch (error) {
        console.error('校正失敗:', error);
        this.textContent = '校正失敗';
        this.disabled = false;
    }
});

// --- 平台資訊 ---
permissionInfoElem.textContent = `平台: ${motionController.getPlatform()}\n平台支援: ${motionController.isPlatformSupported() ? '是' : '否'}`;
console.log('平台權限:', motionController.getPermissions());

if (motionController.isPlatformSupported()) {
     console.log('平台支援體感控制');
} else {
    alert('平台可能不支援體感控制');
}

const instructions = motionController.getPlatformInstructions();
console.log('使用說明:', instructions);


// --- 可選的額外功能 ---

// 添加暫停/恢復功能
let isPaused = false;
function togglePause() {
    if (isPaused) {
        motionController.resume();
        isPaused = false;
        console.log('已恢復感應器');
    } else {
        motionController.pause();
        isPaused = true;
        console.log('已暫停感應器');
    }
}

// 添加重置功能
function resetController() {
    motionController.reset();
    calibrateButton.textContent = '開始校正';
    calibrateButton.disabled = false;
    calibrationDataElem.innerHTML = '尚未校正';
    directionDisplayElem.textContent = '靜止';
    console.log('控制器已重置');
}

// 監聽頁面卸載事件，清理資源
window.addEventListener('beforeunload', () => {
    motionController.destroy();
});

// --- 除錯資訊 ---
if (motionController.config.debugMode) {
    // 每秒顯示一次狀態資訊
    setInterval(() => {
        const state = motionController.getState();
        console.log('狀態:', {
            isActive: state.isActive,
            isCalibrated: state.isCalibrated,
            currentDirection: state.currentDirection,
            historyLength: state.rawHistory.length
        });
    }, 5000);
}

// --- 動態配置調整（可選）---
function updateSensitivity(newThreshold) {
    motionController.setConfig({
        movementThreshold: newThreshold
    });
    console.log('靈敏度已更新:', newThreshold);
}

function toggleAudio() {
    const currentConfig = motionController.config;
    motionController.setConfig({
        enableAudio: !currentConfig.enableAudio
    });
    console.log('音效已', currentConfig.enableAudio ? '關閉' : '開啟');
}

function toggleVibration() {
    const currentConfig = motionController.config;
    motionController.setConfig({
        enableVibration: !currentConfig.enableVibration
    });
    console.log('震動已', currentConfig.enableVibration ? '關閉' : '開啟');
}

// 將這些函式暴露到全域，方便在控制台或其他地方使用
window.motionController = motionController;
window.togglePause = togglePause;
window.resetController = resetController;
window.updateSensitivity = updateSensitivity;
window.toggleAudio = toggleAudio;
window.toggleVibration = toggleVibration;
    // --- 元素宣告  ---
    const permissionButton = document.getElementById('permission-button');
    const calibrateButton = document.getElementById('calibrate-button');
    const rawDataElem = document.getElementById('raw-data');
    const calibrationDataElem = document.getElementById('calibration-data');
    const directionDisplayElem = document.getElementById('direction-display'); 

    // --- 變數宣告 ---
    let calibration = { alpha: 0, beta: 0, gamma: 0 }; 
    let isCalibrated = false;
    let currentAlpha = 0;
    let currentBeta = 0;
    let currentGamma = 0; 
    const MOVEMENT_THRESHOLD = 20;
    let lastDirection = '靜止';

    let audioContext;

    // --- 聲音播放函式 ---
    function playFeedbackSound(direction) {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const panner = audioContext.createStereoPanner();
        oscillator.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(audioContext.destination);
        let panValue = 0;
        gainNode.gain.value = 0.3;
        oscillator.type = 'sine';
        switch (direction) {
            case '往上':
                oscillator.frequency.value = 800; panValue = 0; break;
            case '往下':
                oscillator.frequency.value = 400; panValue = 0; break;
            case '往左':
                oscillator.frequency.value = 600; panValue = -1; break;
            case '往右':
                oscillator.frequency.value = 600; panValue = 1; break;
            case '靜止':
                if (lastDirection !== '靜止') {
                    oscillator.frequency.value = 200;
                    gainNode.gain.value = 0.15;
                    panValue = 0;
                } else { return; }
                break;
        }
        const now = audioContext.currentTime;
        panner.pan.setValueAtTime(panValue, now);
        oscillator.start(now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
        oscillator.stop(now + 0.1);
    }
    
    // --- 權限請求 ---
    function requestSensorPermission() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(state => {
                if (state === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    this.textContent = '感應器已啟用'; this.disabled = true;
                }
            }).catch(console.error);
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
            this.textContent = '感應器已啟用'; this.disabled = true;
        }
    }
    permissionButton.addEventListener('click', requestSensorPermission);

    // --- 校正與陀螺儀處理  ---
    calibrateButton.addEventListener('click', () => {
        calibration.alpha = currentAlpha;
        calibration.beta = currentBeta;
        calibration.gamma = currentGamma; // 順便記錄gamma
        isCalibrated = true;
        // 更新校正基準顯示
        calibrationDataElem.innerHTML = `Alpha: ${calibration.alpha.toFixed(1)}, Beta: ${calibration.beta.toFixed(1)}, Gamma: ${calibration.gamma.toFixed(1)}`;
    });

    function handleOrientation(event) {
        if (event.alpha === null || event.beta === null || event.gamma === null) return;
        currentAlpha = event.alpha;
        currentBeta = event.beta;
        currentGamma = event.gamma; // 捕獲gamma值

        // 更新原始數據顯示
        rawDataElem.innerHTML = `Alpha: ${currentAlpha.toFixed(1)}, Beta: ${currentBeta.toFixed(1)}, Gamma: ${currentGamma.toFixed(1)}`;
        
        if (!isCalibrated) return;

        const relativeBeta = currentBeta - calibration.beta;
        let diff = currentAlpha - calibration.alpha;
        if (diff < -180) diff += 360; 
        else if (diff > 180) diff -= 360;
        
        updateMovementDirection(relativeBeta, diff);
    }
    
    // --- 判斷方向  ---
    function updateMovementDirection(beta, alpha) {
    const absAlpha = Math.abs(alpha);
    const absBeta = Math.abs(beta);

    let direction = '靜止';

    // 判斷哪個方向的偏移量比較大，避免混淆
    if (absBeta > absAlpha) {
        if (beta > MOVEMENT_THRESHOLD) direction = "往上";
        else if (beta < -MOVEMENT_THRESHOLD) direction = "往下";
    } else {
        if (alpha < -MOVEMENT_THRESHOLD) direction = "往右";
        else if (alpha > MOVEMENT_THRESHOLD) direction = "往左";
    }
    // 音效與畫面更新
    if (direction !== lastDirection) {
        playFeedbackSound(direction);
        directionDisplayElem.textContent = direction;
        lastDirection = direction;
    }
}
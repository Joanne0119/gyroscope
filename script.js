const motionController = new MotionController({
    movementThreshold: 15,
    enableAudio: true,
    enableVibration: true,
    debugMode: true,
    autoCalibrate: true
});

// 設定回調
motionController.on('directionChange', (direction, lastDirection) => {
    console.log(`方向變化: ${lastDirection} → ${direction}`);
    document.getElementById('direction-display').textContent = direction;
});

motionController.on('calibrationComplete', (calibration) => {
    console.log('校正完成:', calibration);
    document.getElementById('calibration-data').textContent = 
        `Alpha: ${calibration.alpha.toFixed(1)}, Beta: ${calibration.beta.toFixed(1)}, Gamma: ${calibration.gamma.toFixed(1)}`;
});

motionController.on('sensorData', (data) => {
    document.getElementById('raw-data').textContent = 
        `Alpha: ${data.raw.alpha.toFixed(1)}, Beta: ${data.raw.beta.toFixed(1)}, Gamma: ${data.raw.gamma.toFixed(1)}`;
});

// 初始化
motionController.init().then(success => {
    if (success) {
        console.log('體感控制器初始化成功');
    } else {
        console.log('體感控制器初始化失敗');
    }
});
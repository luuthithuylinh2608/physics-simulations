const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
const car = document.getElementById('car');
const startBtn = document.getElementById('btn-start');
const pauseBtn = document.getElementById('btn-pause');
const resetBtn = document.getElementById('btn-reset');
const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');
const speedKmhVal = document.getElementById('speed-kmh-val');
const markersContainer = document.getElementById('markers-container');

// Physics Configuration
const SCALE = 10; // 10px = 1m
const MAX_DISTANCE = 80; // 80m track length
const S_CAM1 = 30; // Camera 1 at 30m
const S_CAM2 = 40; // Camera 2 at 40m
const D_CAM = S_CAM2 - S_CAM1;
const SPEED_LIMIT_KMH = 60; // 60 km/h

// Simulation State
let time = 0; // seconds
let distance = 0; // meters
let speed = 5; // m/s
let isRunning = false;
let isPaused = false;
let lastTime = 0;
let dataPoints = [];
let animFrameId = null;

let t1 = undefined;
let t2 = undefined;
let calculatedVelocityKmh = 0;

let currentScenario = 0; // 0=None, 1=SpeedSwitch, 2=RedLight, 3=PoliceTest
let scenarioState = 0;

// Initialize Road Markers
function initMarkers() {
    markersContainer.innerHTML = '';
    for (let i = 0; i <= MAX_DISTANCE; i += 10) {
        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.style.left = (i * SCALE) + 'px';
        
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = i + 'm';
        
        marker.appendChild(label);
        markersContainer.appendChild(marker);
    }
}

// Window sizing setup
function resizeCanvas() {
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    drawGraph();
}
window.addEventListener('resize', resizeCanvas);


// Core Loop
function update(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const dt = (currentTime - lastTime) / 1000; // ms to s
    lastTime = currentTime;

    if (isRunning) {
        if (!isPaused) {
            time += dt;
            distance += speed * dt;
        } else {
            time += dt; // Time continues to tick if it's paused during a "red light" scenario
        }

        handleScenarios();

        // Save data point
        dataPoints.push({ t: time, s: distance });
        
        // Render Car position
        car.style.left = (distance * SCALE) + 'px';

        // Check against Speed Cameras
        checkSpeedCameras();
        
        // Draw real-time Graph
        drawGraph();
        
        // Stop condition
        if (distance >= MAX_DISTANCE) {
            isRunning = false;
            startBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Xong';
        }
    }

    animFrameId = requestAnimationFrame(update);
}

// Scenario specific logic
function handleScenarios() {
    if (currentScenario === 1) { // Speed change
        // Run at 5m/s for 20m, then suddenly change to 10m/s
        if (distance >= 20 && scenarioState === 0) {
            setSystemSpeedTemp(10);
            scenarioState = 1;
        }
    } else if (currentScenario === 2) { // Red light
        // Stop at 20m for 3s
        if (distance >= 20 && scenarioState === 0) {
            isPaused = true;
            scenarioState = 1;
            setTimeout(() => {
                if (currentScenario === 2) { // insure scenario wasn't reset
                    isPaused = false;
                    scenarioState = 2; // continue
                }
            }, 3000);
        }
    }
}

// Camera Detection Engine
function checkSpeedCameras() {
    const cam1El = document.getElementById('cam1');
    const cam2El = document.getElementById('cam2');
    
    // Cross CAM 1
    if (distance >= S_CAM1 && t1 === undefined) {
        t1 = time;
        document.getElementById('res-t1').textContent = t1.toFixed(2) + ' s';
        triggerFlash(cam1El);
    }
    
    // Cross CAM 2
    if (distance >= S_CAM2 && t2 === undefined) {
        t2 = time;
        document.getElementById('res-t2').textContent = t2.toFixed(2) + ' s';
        triggerFlash(cam2El);
        
        // Compute Results
        const dt_calc = t2 - t1;
        const v_calc_ms = D_CAM / dt_calc;
        calculatedVelocityKmh = v_calc_ms * 3.6;
        
        document.getElementById('res-dt').textContent = dt_calc.toFixed(2) + ' s';
        document.getElementById('res-v').textContent = calculatedVelocityKmh.toFixed(1) + ' km/h';
        
        // Show status
        const statusBadge = document.getElementById('violation-status');
        if (calculatedVelocityKmh > SPEED_LIMIT_KMH) {
            statusBadge.innerHTML = '🚨 VI PHẠM TỐC ĐỘ! 🚨';
            statusBadge.className = 'status-badge violation';
        } else {
            statusBadge.innerHTML = '✅ AN TOÀN';
            statusBadge.className = 'status-badge safe';
        }
    }
}

function triggerFlash(el) {
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 150);
}

// Graph Engine
function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const PADDING = { top: 20, right: 30, bottom: 40, left: 50 };
    const w = canvas.width - PADDING.left - PADDING.right;
    const h = canvas.height - PADDING.top - PADDING.bottom;
    
    const maxTimeDisplay = Math.max(10, Math.ceil(time / 5) * 5); // scale nicely in multiples of 5
    
    // Draw Grid Variables
    const timeSteps = 10;
    const distSteps = MAX_DISTANCE;

    ctx.lineWidth = 1;
    ctx.font = '11px Inter, system-ui';

    // Vertical grid (X-axis = Time)
    for(let i = 0; i <= maxTimeDisplay; i += (maxTimeDisplay/timeSteps)) {
        let x = PADDING.left + (i / maxTimeDisplay) * w;
        
        ctx.strokeStyle = 'rgba(139, 148, 158, 0.2)';
        ctx.beginPath();
        ctx.moveTo(x, PADDING.top);
        ctx.lineTo(x, PADDING.top + h);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(139, 148, 158, 0.8)';
        ctx.textAlign = 'center';
        ctx.fillText(i.toFixed(1) + 's', x, PADDING.top + h + 15);
    }
    
    // Horizontal grid (Y-axis = Distance)
    for(let i = 0; i <= distSteps; i += 10) {
        let y = PADDING.top + h - (i / distSteps) * h;
        
        ctx.strokeStyle = 'rgba(139, 148, 158, 0.2)';
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(PADDING.left + w, y);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(139, 148, 158, 0.8)';
        ctx.textAlign = 'right';
        ctx.fillText(i + 'm', PADDING.left - 10, y + 4);
    }
    
    // Draw Axes Lines
    ctx.strokeStyle = '#e6edf3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top);
    ctx.lineTo(PADDING.left, PADDING.top + h);
    ctx.lineTo(PADDING.left + w, PADDING.top + h);
    ctx.stroke();

    // Axis Labels
    ctx.fillStyle = '#58a6ff';
    ctx.textAlign = 'left';
    ctx.fillText('Quãng đường s (m)', 10, 15);
    ctx.textAlign = 'right';
    ctx.fillText('Thời gian t (s)', canvas.width - 5, canvas.height - 10);
    
    // Draw Line Graph
    if (dataPoints.length > 0) {
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#58a6ff';
        ctx.shadowBlur = 10;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        let first = true;
        for (let pt of dataPoints) {
            let x = PADDING.left + (pt.t / maxTimeDisplay) * w;
            let y = PADDING.top + h - (pt.s / distSteps) * h;
            
            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}


function setSystemSpeedTemp(val) {
    speed = val;
    speedSlider.value = val;
    speedVal.textContent = val.toFixed(1);
    speedKmhVal.textContent = (val * 3.6).toFixed(1);
}

// UI Triggers Update
speedSlider.addEventListener('input', (e) => {
    if (currentScenario !== 0 && currentScenario !== 3) {
        // If scenario 1 or 2 is active, decouple it so user regains manual control
        stopAllScenarios();
    }
    setSystemSpeedTemp(parseFloat(e.target.value));
});

startBtn.addEventListener('click', () => {
    if (distance >= MAX_DISTANCE) {
        // Just reset if it's already done
        resetSystemLogic();
    }
    if (!isRunning) {
        lastTime = performance.now();
    }
    isRunning = true;
    isPaused = false;
    startBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Đang chạy...';
    
    // Update pause btn UI
    pauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Tạm dừng';
    pauseBtn.className = 'btn warning';
});

pauseBtn.addEventListener('click', () => {
    if (!isRunning) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        pauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Tiếp tục';
        pauseBtn.className = 'btn primary';
    } else {
        pauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Tạm dừng';
        pauseBtn.className = 'btn warning';
    }
});

function resetSystemLogic() {
    isRunning = false;
    isPaused = false;
    time = 0;
    distance = 0;
    t1 = undefined;
    t2 = undefined;
    dataPoints = [];
    scenarioState = 0;
    
    setSystemSpeedTemp(parseFloat(speedSlider.value));
    
    document.getElementById('res-t1').textContent = '-- s';
    document.getElementById('res-t2').textContent = '-- s';
    document.getElementById('res-dt').textContent = '-- s';
    document.getElementById('res-v').textContent = '-- km/h';
    
    const badge = document.getElementById('violation-status');
    badge.innerHTML = 'Hệ thống đang chờ...';
    badge.className = 'status-badge';
    
    car.style.left = '0px';
    startBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Bắt đầu';
    pauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Tạm dừng';
    pauseBtn.className = 'btn warning';
    
    drawGraph();
}

resetBtn.addEventListener('click', () => {
    stopAllScenarios();
    resetSystemLogic();
});

function stopAllScenarios() {
    currentScenario = 0;
    document.querySelectorAll('.scenarios .btn').forEach(b => b.classList.remove('active'));
}

// Scenarios Triggers
document.getElementById('btn-scenario-1').addEventListener('click', function() {
    stopAllScenarios();
    this.classList.add('active');
    currentScenario = 1;
    resetSystemLogic();
    setSystemSpeedTemp(5);
});

document.getElementById('btn-scenario-2').addEventListener('click', function() {
    stopAllScenarios();
    this.classList.add('active');
    currentScenario = 2;
    resetSystemLogic();
    setSystemSpeedTemp(8); 
});

document.getElementById('btn-scenario-3').addEventListener('click', function() {
    stopAllScenarios();
    this.classList.add('active');
    currentScenario = 3;
    resetSystemLogic();
    // Gợi ý cho HS tốc độ giới hạn 16.67 m/s (60km/h), khởi tạo giá trị cao để thử thách
    setSystemSpeedTemp(20);
});

// INITIALIZE SYSTEM
initMarkers();
setSystemSpeedTemp(5);

// Let DOM settle then init graphic engine
setTimeout(() => {
    resizeCanvas();
    animFrameId = requestAnimationFrame(update);
}, 200);

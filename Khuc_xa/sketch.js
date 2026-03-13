let angleSlider, n1Slider, n2Slider, intensitySlider;
let toggleNormal, toggleAngles, toggleRough;
let n1Val, n2Val, angleVal, intensityVal;
let canvas;

// State
let state = {
    angleI: 45,
    n1: 1.00,
    n2: 1.33,
    intensity: 100,
    isMirror: false,
    compareMode: false,
    predictMode: false,
    hasPredicted: false,
    isDragging: false,
    material: 'water'
};

function setup() {
    let container = document.getElementById('canvas-container');
    let w = container.clientWidth;
    let h = container.clientHeight;
    canvas = createCanvas(w, h);
    canvas.parent('canvas-container');

    // Link DOM elements
    angleSlider = select('#angle-slider');
    n1Slider = select('#n1-slider');
    n2Slider = select('#n2-slider');
    intensitySlider = select('#intensity-slider');
    
    toggleNormal = select('#toggle-normal');
    toggleAngles = select('#toggle-angles');
    toggleRough = select('#toggle-rough');

    // Values display
    angleVal = select('#angle-val');
    n1Val = select('#n1-val');
    n2Val = select('#n2-val');
    intensityVal = select('#intensity-val');

    // Material buttons
    selectAll('.mat-btn').forEach(btn => {
        btn.mouseClicked(() => {
            let n = btn.attribute('data-n');
            selectAll('.mat-btn').forEach(b => b.removeClass('active'));
            btn.addClass('active');

            if (n === 'mirror') {
                state.isMirror = true;
                state.n2 = 1.0;
                state.material = 'mirror';
            } else {
                state.isMirror = false;
                state.n2 = parseFloat(n);
                state.material = btn.id();
                n2Slider.value(state.n2);
                n2Val.html(state.n2.toFixed(2));
            }
        });
    });

    // Action buttons
    select('#reset-btn').mouseClicked(() => location.reload());
    select('#compare-btn').mouseClicked(() => {
        state.compareMode = !state.compareMode;
        select('#compare-btn').style('background', state.compareMode ? '#ff9800' : '');
    });
    select('#predict-btn').mouseClicked(() => {
        state.predictMode = true;
        state.hasPredicted = false;
        select('#prediction-overlay').style('display', 'flex');
    });

    selectAll('.opt-btn').forEach(btn => {
        btn.mouseClicked(() => {
            state.hasPredicted = true;
            state.predictMode = false;
            select('#prediction-overlay').style('display', 'none');
        });
    });

    windowResized();
}

function windowResized() {
    let container = document.getElementById('canvas-container');
    resizeCanvas(container.clientWidth, container.clientHeight);
}

function draw() {
    // Update state from sliders
    state.angleI = parseInt(angleSlider.value());
    state.n1 = parseFloat(n1Slider.value());
    if (!state.isMirror) {
        state.n2 = parseFloat(n2Slider.value());
    }
    state.intensity = parseInt(intensitySlider.value());

    // Update displays
    angleVal.html(state.angleI);
    n1Val.html(state.n1.toFixed(2));
    n2Val.html(state.n2.toFixed(2));
    intensityVal.html(state.intensity);

    background(255);
    let centerX = width / 2;
    let centerY = height / 2;
    let radius = min(width, height) * 0.4;

    // 1. Draw Media
    noStroke();
    // Top (n1)
    fill(255, 255, 255, 0); 
    rect(0, 0, width, centerY);

    // Bottom (n2)
    let n2Color = color(3, 169, 244, 40); // Water
    if (state.n2 > 1.4 && state.n2 <= 1.6 && state.material !== 'wall') n2Color = color(121, 134, 151, 40); // Glass
    if (state.n2 > 1.6 && state.material !== 'wall') n2Color = color(121, 85, 72, 40); // Stone
    if (state.material === 'wall') n2Color = color(62, 39, 35, 230); // Darker brown for wall
    fill(n2Color);
    rect(0, centerY, width, height - centerY);

    // 1.5 Interface (Bumpy or Smooth)
    if (toggleRough.checked() || state.material === 'wall') {
        drawBumpyInterface(centerY);
    } else {
        stroke(255);
        strokeWeight(3);
        line(0, centerY, width, centerY);
    }

    // Center point O
    fill(255);
    noStroke();
    circle(centerX, centerY, 8);

    // 2. Normal Line
    if (toggleNormal.checked()) {
        stroke(120, 144, 156);
        strokeWeight(1);
        drawingContext.setLineDash([10, 10]);
        line(centerX, 0, centerX, height);
        drawingContext.setLineDash([]);
    }

    // 3. Ray Casting Calculations
    let iRad = radians(state.angleI);
    
    // Incident Point (Laser position)
    let incX = centerX - radius * sin(iRad);
    let incY = centerY - radius * cos(iRad);

    // Reflected
    let refX = centerX + radius * sin(iRad);
    let refY = centerY - radius * cos(iRad);

    // Refracted (Snell's Law)
    let sinR = (state.n1 * sin(iRad)) / state.n2;
    let rRad = 0;
    let isTIR = false;
    if (abs(sinR) > 1) {
        if (state.n1 > state.n2) isTIR = true;
    } else {
        rRad = asin(sinR);
    }

    let refrX = centerX + radius * sin(rRad);
    let refrY = centerY + radius * cos(rRad);

    // 4. Draw Components
    drawLaser(incX, incY, iRad);

    // 5. Draw Rays
    let globalAlpha = map(state.intensity, 0, 100, 0, 255);
    
    // Incident Ray (Now Deep Red)
    drawRay(incX, incY, centerX, centerY, color(200, 0, 0, globalAlpha), 4);

    // Reflected Ray (Orange)
    let refOpacity = isTIR ? 1.0 : 0.4;
    drawRay(centerX, centerY, refX, refY, color(255, 152, 0, globalAlpha * refOpacity), 3);

    // Diffuse Reflection (Scattering)
    if (toggleRough.checked() || state.material === 'wall') {
        for(let j=0; j<12; j++) {
            let scatterAngle = radians(state.angleI + random(-30, 30));
            let sx = centerX + radius * 0.8 * sin(scatterAngle);
            let sy = centerY - radius * 0.8 * cos(scatterAngle);
            drawRay(centerX, centerY, sx, sy, color(255, 152, 0, globalAlpha * 0.15), 1);
        }
    }

    // Refracted Ray (Blue)
    if (!isTIR && !state.isMirror && (!state.predictMode || state.hasPredicted)) {
        if (state.compareMode) {
            let nList = [1.33, 1.50, 1.70];
            let cList = [color(0, 188, 212), color(103, 58, 183), color(121, 85, 72)];
            nList.forEach((cn, idx) => {
                let sR = (state.n1 * sin(iRad)) / cn;
                if (abs(sR) <= 1) {
                    let rR = asin(sR);
                    let rx = centerX + radius * sin(rR);
                    let ry = centerY + radius * cos(rR);
                    drawRay(centerX, centerY, rx, ry, cList[idx], 3);
                }
            });
        } else {
            let refrOpacity = 1.0;
            if (state.material === 'wall') refrOpacity = 0.15; // 15% opacity for wall

            if (toggleRough.checked()) {
                for(let k=0; k<5; k++) {
                    let jitter = random(-0.05, 0.05);
                    drawRay(centerX, centerY, centerX + radius * sin(rRad+jitter), centerY + radius * cos(rRad+jitter), color(3, 169, 244, globalAlpha * 0.3 * refrOpacity), 1);
                }
                drawRay(centerX, centerY, refrX, refrY, color(3, 169, 244, globalAlpha * 0.6 * refrOpacity), 3);
            } else {
                drawRay(centerX, centerY, refrX, refrY, color(3, 169, 244, globalAlpha * refrOpacity), 3);
            }
        }
    } else if (isTIR && (!state.predictMode || state.hasPredicted)) {
        textAlign(CENTER);
        fill(255, 82, 82);
        noStroke();
        textSize(20);
        textStyle(BOLD);
        text("PHẢN XẠ TOÀN PHẦN", centerX, centerY + 60);
    }

    // 6. Angles Display
    if (toggleAngles.checked()) {
        drawAngleLabel(centerX, centerY, -HALF_PI, -HALF_PI + iRad, 50, "i = " + state.angleI + "°", color(255, 193, 7));
        if (!isTIR && !state.isMirror && (!state.predictMode || state.hasPredicted)) {
            drawAngleLabel(centerX, centerY, HALF_PI, HALF_PI - rRad, 50, "r = " + round(degrees(rRad)) + "°", color(3, 169, 244));
        }
    }
}

function drawLaser(x, y, angle) {
    push();
    translate(x, y);
    rotate(angle + HALF_PI);
    
    // Body
    fill(55, 71, 79);
    noStroke();
    rectMode(CENTER);
    rect(-10, 0, 40, 20, 5);
    
    // Tip
    fill(183, 28, 28);
    rect(15, 0, 10, 12, 2);
    
    // Beam start glow
    fill(255, 235, 59, 150);
    circle(20, 0, 5);
    pop();
}

function drawRay(x1, y1, x2, y2, col, weight) {
    stroke(col);
    strokeWeight(weight);
    line(x1, y1, x2, y2);
}

function drawBumpyInterface(y) {
    stroke(255, 255, 255, 200);
    strokeWeight(2);
    noFill();
    beginShape();
    for (let x = 0; x <= width; x += 5) {
        let nx = map(x, 0, width, 0, 10);
        let offset = map(noise(nx, frameCount * 0.01), 0, 1, -5, 5);
        vertex(x, y + offset);
    }
    endShape();
}

function drawAngleLabel(x, y, start, end, rad, label, col) {
    noFill();
    stroke(col);
    strokeWeight(2);
    arc(x, y, rad * 2, rad * 2, min(start, end), max(start, end));
    
    let mid = (start + end) / 2;
    let lx = x + (rad + 25) * cos(mid);
    let ly = y + (rad + 25) * sin(mid);
    
    fill(col);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(14);
    textStyle(BOLD);
    text(label, lx, ly);
}

// Mouse Drag Support
function mousePressed() {
    let centerX = width / 2;
    let centerY = height / 2;
    let iRad = radians(state.angleI);
    let radius = min(width, height) * 0.4;
    let incX = centerX - radius * sin(iRad);
    let incY = centerY - radius * cos(iRad);
    
    if (dist(mouseX, mouseY, incX, incY) < 50) {
        state.isDragging = true;
    }
}

function mouseDragged() {
    if (state.isDragging) {
        let centerX = width / 2;
        let centerY = height / 2;
        let angle = degrees(atan2(centerX - mouseX, centerY - mouseY));
        if (angle < 0) angle = 0;
        if (angle > 80) angle = 80;
        state.angleI = Math.round(angle);
        angleSlider.value(state.angleI);
    }
}

function mouseReleased() {
    state.isDragging = false;
}

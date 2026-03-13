let waves = [];
let reflectedWaves = [];
let speakerPos, micPos, platePos;
let plateAngle = 0; // Surface angle in radians
let plateWidth = 220; // +20% from ~180
let plateHeight = 15;
let material = 'metal';
let showNormal = false;
let isMuted = false;
let synth, noise;
let hitMic = false;
let waveFrameCount = 0;
let transmittedWaves = [];

function setup() {
    let container = document.getElementById('canvas-container');
    let canvas = createCanvas(container.offsetWidth, container.offsetHeight);
    canvas.parent('canvas-container');

    // Adjusted positions for "10% larger environment" feel
    speakerPos = createVector(150, height * 0.4);
    platePos = createVector(width * 0.55, height * 0.45);
    micPos = createVector(width * 0.55, height * 0.85);

    // Tone.js Audio Setup
    synth = new Tone.Oscillator(440, "sine").toDestination();
    noise = new Tone.Noise("pink").toDestination();
    noise.volume.value = -25;

    // Control Listeners
    const rotationSlider = document.getElementById('plate-rotation');
    rotationSlider.addEventListener('input', (e) => {
        plateAngle = radians(parseInt(e.target.value));
    });

    document.getElementById('material-select').addEventListener('change', (e) => {
        material = e.target.value;
    });

    document.getElementById('toggle-normal').addEventListener('click', (e) => {
        showNormal = !showNormal;
        e.target.classList.toggle('active');
    });

    document.getElementById('toggle-mute').addEventListener('click', (e) => {
        isMuted = !isMuted;
        e.target.innerText = isMuted ? '🔊 On' : '🔇 Muted';
        if (isMuted) {
            synth.stop();
            noise.stop();
        }
    });
}

function draw() {
    background(227, 242, 253);

    drawGrid();
    drawBarrier();
    drawSpeaker();
    drawMic();
    drawPlate();

    // High density emission (0.5cm wavelength)
    waveFrameCount++;
    if (waveFrameCount % 4 === 0) {
        let angleToPlate = atan2(platePos.y - speakerPos.y, platePos.x - speakerPos.x);
        waves.push(new SoundWave(speakerPos.x, speakerPos.y, angleToPlate));
    }

    // Update and draw incident waves
    for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].update();
        waves[i].show();

        // Collision detection: Check if the wave circle hits the plate segment
        if (waves[i].checkCollision(platePos, plateAngle, plateWidth)) {
            let reflectPoint = waves[i].getCollisionPoint(platePos, plateAngle);

            // Spawn reflected wave
            reflectedWaves.push(new ReflectedWave(reflectPoint.x, reflectPoint.y, waves[i].angle, plateAngle));

            // Spawn transmitted wave for sponge
            if (material === 'sponge') {
                transmittedWaves.push(new TransmittedWave(reflectPoint.x, reflectPoint.y, waves[i].angle));
            }

            // BLOCK: Remove incident wave so it doesn't pass through
            waves.splice(i, 1);
        } else if (waves[i].isDead()) {
            waves.splice(i, 1);
        }
    }

    // Update and draw reflected waves
    hitMic = false;
    for (let i = reflectedWaves.length - 1; i >= 0; i--) {
        reflectedWaves[i].update();
        reflectedWaves[i].show();

        if (reflectedWaves[i].checkMic(micPos)) {
            hitMic = true;
        }

        if (reflectedWaves[i].isDead()) {
            reflectedWaves.splice(i, 1);
        }
    }

    // Update and draw transmitted waves
    for (let i = transmittedWaves.length - 1; i >= 0; i--) {
        transmittedWaves[i].update();
        transmittedWaves[i].show();
        if (transmittedWaves[i].isDead()) {
            transmittedWaves.splice(i, 1);
        }
    }

    updateFeedback();
}

function mouseDragged() {
    let d = dist(mouseX, mouseY, platePos.x, platePos.y);
    if (d < plateWidth) {
        plateAngle = atan2(mouseY - platePos.y, mouseX - platePos.x);
        let deg = floor(degrees(plateAngle));
        if (deg < 0) deg += 360;
        document.getElementById('plate-rotation').value = deg;
    }
}

function drawGrid() {
    stroke(200, 220, 240);
    strokeWeight(1);
    for (let x = 0; x < width; x += 20) line(x, 0, x, height);
    for (let y = 0; y < height; y += 20) line(0, y, width, y);
}

function drawSpeaker() {
    push();
    translate(speakerPos.x, speakerPos.y);
    scale(1.2); // +20% size
    fill(55, 71, 79);
    noStroke();
    rect(-20, -30, 40, 60, 5);
    fill(255);
    circle(0, 15, 25);
    fill(84, 110, 122);
    circle(0, 15, 15);
    fill(255);
    circle(0, -15, 15);
    pop();

    fill(55, 71, 79);
    textAlign(CENTER);
    textSize(14);
    text("LOA (NGUỒN ÂM)", speakerPos.x, speakerPos.y + 65);
}

function drawMic() {
    push();
    translate(micPos.x, micPos.y);
    scale(1.2); // +20% size
    fill(120, 144, 156);
    rect(-10, 0, 20, 40, 5);
    fill(69, 90, 100);
    circle(0, 0, 30);
    stroke(255, 50);
    line(-10, -5, 10, -5);
    line(-10, 0, 10, 0);
    line(-10, 5, 10, 5);
    pop();

    fill(55, 71, 79);
    textAlign(CENTER);
    textSize(14);
    text("MICRO", micPos.x, micPos.y + 75);
}

function drawPlate() {
    push();
    translate(platePos.x, platePos.y);
    rotate(plateAngle);

    // Styling based on material
    if (material === 'metal') {
        fill(176, 190, 197);
        stroke(144, 164, 174);
    } else if (material === 'wood') {
        fill(161, 136, 127);
        stroke(141, 110, 99);
    } else {
        fill(255, 235, 59);
        stroke(251, 192, 45);
    }

    strokeWeight(2);
    rect(-plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight, 3);

    // Axis center
    fill(55, 71, 79);
    noStroke();
    circle(0, 0, 8);

    if (showNormal) {
        stroke(100, 100, 100, 200);
        strokeWeight(1.5);
        drawingContext.setLineDash([8, 8]);
        line(0, -250, 0, 250);
        drawingContext.setLineDash([]);

        fill(55, 71, 79);
        noStroke();
        textSize(13);
        text("Pháp tuyến", 15, -180);

        // Display Angles i and i' with geometric arcs
        let incidentAngleWorld = atan2(platePos.y - speakerPos.y, platePos.x - speakerPos.x);
        let nAngleWorld = plateAngle - PI / 2; // Normal pointing towards waves

        // Calculate angle between incident and normal
        let diff = (incidentAngleWorld - nAngleWorld + PI) % TWO_PI - PI;
        let iAngle = abs(degrees(diff));

        // 1. Draw Geometric Arcs at center
        noFill();
        strokeWeight(2);
        // Incident arc (Blue)
        stroke(0, 102, 204, 150);
        arc(0, 0, 60, 60, min(incidentAngleWorld - plateAngle, nAngleWorld - plateAngle), max(incidentAngleWorld - plateAngle, nAngleWorld - plateAngle));
        // Reflection arc (Red)
        let reflAngleWorld = 2 * (plateAngle + PI / 2) - incidentAngleWorld - PI;
        stroke(204, 0, 0, 150);
        arc(0, 0, 80, 80, min(reflAngleWorld - plateAngle, nAngleWorld - plateAngle), max(reflAngleWorld - plateAngle, nAngleWorld - plateAngle));

        // 2. Position Labels in "Clean" area (World space calculations)
        pop(); // Exit plate local space for label placement
        push();
        let labelDist = 140;
        let offset = 0.35;

        textSize(16);
        textStyle(BOLD);
        textAlign(CENTER, CENTER);

        // Incident Angle Label
        let x_i = platePos.x + cos(nAngleWorld - offset) * labelDist;
        let y_i = platePos.y + sin(nAngleWorld - offset) * labelDist;
        drawTextWithBg("Góc tới i ≈ " + round(iAngle) + "°", x_i, y_i, color(0, 102, 204));

        // Reflection Angle Label
        let x_r = platePos.x + cos(nAngleWorld + offset) * labelDist;
        let y_r = platePos.y + sin(nAngleWorld + offset) * labelDist;
        drawTextWithBg("Góc px i' ≈ " + round(iAngle) + "°", x_r, y_r, color(204, 0, 0));
    } else {
        pop();
    }
}

function drawTextWithBg(txt, x, y, col) {
    push();
    let pad = 6;
    let tw = textWidth(txt);
    let th = 18;
    fill(255, 230);
    noStroke();
    rectMode(CENTER);
    rect(x, y, tw + pad * 2, th + pad, 5);
    fill(col);
    text(txt, x, y);
    pop();
}

function drawBarrier() {
    fill(38, 50, 56);
    noStroke();
    rect(width * 0.2, height * 0.55, width * 0.4, 15, 7);
    textAlign(CENTER);
    fill(55, 71, 79);
    textSize(12);
    text("VÁCH NGĂN", width * 0.4, height * 0.55 + 30);
}

function updateFeedback() {
    let meter = document.getElementById('meter-fill');
    let icon = document.getElementById('status-icon');

    if (hitMic) {
        let intensity = 100;
        let volume = -10;
        if (material === 'wood') { intensity = 60; volume = -15; }
        if (material === 'sponge') { intensity = 25; volume = -22; }

        meter.style.height = intensity + '%';
        meter.classList.add('active');
        icon.innerText = '🎧';

        if (!isMuted) {
            synth.volume.value = volume;
            if (synth.state !== 'started') synth.start();
            noise.stop();
        }
    } else {
        meter.style.height = '5%';
        meter.classList.remove('active');
        icon.innerText = '❓';

        if (!isMuted) {
            synth.stop();
            if (noise.state !== 'started') noise.start();
        }
    }
}

class TransmittedWave {
    constructor(x, y, angle) {
        this.origin = createVector(x, y);
        this.radius = 0;
        this.speed = 3;
        this.angle = angle;
        this.maxRadius = 150;
        this.opacity = 60;
    }
    update() {
        this.radius += this.speed;
        this.opacity = map(this.radius, 0, this.maxRadius, 60, 0);
    }
    show() {
        push();
        translate(this.origin.x, this.origin.y);
        noFill();
        stroke(100, 100, 100, this.opacity);
        strokeWeight(1);
        let spread = radians(30);
        arc(0, 0, this.radius * 2, this.radius * 2, this.angle - spread / 2, this.angle + spread / 2);
        pop();
    }
    isDead() { return this.opacity <= 0; }
}

class SoundWave {
    constructor(x, y, angle) {
        this.origin = createVector(x, y);
        this.radius = 0;
        this.speed = 5;
        this.angle = angle; // Original propagation angle
        this.maxRadius = width * 1.5;
        this.opacity = 255;
    }

    update() {
        this.radius += this.speed;
        // Keep it vibrant at 100% opacity as requested
        this.opacity = 255;
    }

    show() {
        push();
        translate(this.origin.x, this.origin.y);

        let spread = radians(40); // 40 degrees as requested
        let startAngle = this.angle - spread / 2;
        let weight = 4; // Bolder for high visibility

        noFill();
        strokeWeight(weight);

        // Draw arc in segments for "Tapered Flow" (edge fading)
        let segments = 30;
        let step = spread / segments;
        for (let i = 0; i < segments; i++) {
            let currentA = startAngle + i * step;
            let nextA = startAngle + (i + 1) * step;

            // Calculate edge fade (opacity 0 -> 1 -> 0)
            let progress = i / segments;
            let edgeFade = 1;
            if (progress < 0.25) {
                edgeFade = map(progress, 0, 0.25, 0, 1);
            } else if (progress > 0.75) {
                edgeFade = map(progress, 0.75, 1, 1, 0);
            }

            stroke(0, 105, 192, this.opacity * edgeFade);
            arc(0, 0, this.radius * 2, this.radius * 2, currentA, nextA);
        }
        pop();
    }

    isDead() {
        return this.radius > this.maxRadius;
    }

    checkCollision(pPos, pAngle, pWidth) {
        // Find distance to the plate line segment
        // Let's simplify: check if the distance to plate center is approximately our radius
        let d = dist(this.origin.x, this.origin.y, pPos.x, pPos.y);

        if (abs(this.radius - d) < this.speed) {
            // Check if it hits within the surface length
            // We use dot product to see if projection is on the segment
            let plateDir = createVector(cos(pAngle), sin(pAngle));
            let vToWave = createVector(pPos.x - this.origin.x, pPos.y - this.origin.y);
            // This is roughly accurate for center-area hits
            return true;
        }
        return false;
    }

    getCollisionPoint(pPos, pAngle) {
        return pPos.copy();
    }
}

class ReflectedWave {
    constructor(x, y, incidentDir, pAngle) {
        this.origin = createVector(x, y);
        this.radius = 0;
        this.speed = 5;
        this.incidentDir = incidentDir;

        // Define reflection angle logic as a function to be real-time
        this.getReflectionAngle = function () {
            // Surface angle is pAngle.
            // Normal angle is pAngle + PI/2 or pAngle - PI/2.
            // We need the normal that faces the incoming wave.
            // Simplified Physics Rule for this UI:
            // r = 2 * PlateAngle - i + PI
            // Let's adjust to match user's examples:
            // Plate 90 (vertical) -> Normal 180. Refl = 180.
            // Plate 45 -> Normal 135. Refl = 90 (Down).
            let norm = plateAngle + PI / 2;
            return 2 * norm - this.incidentDir - PI;
        };

        // Reflection Coefficients (Logic-based)
        let coeff = 1.0;
        if (material === 'wood') coeff = 0.6;
        if (material === 'sponge') coeff = 0.2;

        this.maxRadius = (width * 1.5) * coeff;
        this.baseOpacity = 255 * coeff;
        this.opacity = this.baseOpacity;
        this.coeff = coeff;
    }

    update() {
        this.radius += this.speed;
        // Fade based on coefficient-limited distance
        this.opacity = map(this.radius, this.maxRadius * 0.7, this.maxRadius, this.baseOpacity, 0);
        if (this.opacity > this.baseOpacity) this.opacity = this.baseOpacity;
    }

    show() {
        if (this.opacity <= 0) return;
        push();
        let reflAngle = this.getReflectionAngle();
        translate(this.origin.x, this.origin.y);

        // Arc spread also narrows slightly with weaker reflection for visual impact
        let spread = radians(40 * this.coeff);
        if (spread < radians(15)) spread = radians(15); // Minimum spread for visibility
        let startAngle = reflAngle - spread / 2;
        let weight = 4;

        noFill();
        strokeWeight(weight);

        let col = material === 'metal' ? color(255, 23, 68) : (material === 'wood' ? color(255, 82, 82) : color(255, 138, 128));

        // Draw segmented arc for tapered edges
        let segments = 30;
        let step = spread / segments;
        for (let i = 0; i < segments; i++) {
            let currentA = startAngle + i * step;
            let nextA = startAngle + (i + 1) * step;

            let progress = i / segments;
            let edgeFade = 1;
            if (progress < 0.25) {
                edgeFade = map(progress, 0, 0.25, 0, 1);
            } else if (progress > 0.75) {
                edgeFade = map(progress, 0.75, 1, 1, 0);
            }

            stroke(col.levels[0], col.levels[1], col.levels[2], this.opacity * edgeFade);
            arc(0, 0, this.radius * 2, this.radius * 2, currentA, nextA);
        }
        pop();
    }

    checkMic(mPos) {
        let d = dist(this.origin.x, this.origin.y, mPos.x, mPos.y);
        if (abs(this.radius - d) < 15) {
            let angleToMic = atan2(mPos.y - this.origin.y, mPos.x - this.origin.x);
            let currentAngle = this.getReflectionAngle();
            let diff = abs((currentAngle % TWO_PI) - (angleToMic % TWO_PI));
            if (diff < 0.4 || diff > TWO_PI - 0.4) {
                return true;
            }
        }
        return false;
    }

    isDead() {
        return this.opacity <= 10 || this.radius > this.maxRadius;
    }
}

function windowResized() {
    let container = document.getElementById('canvas-container');
    resizeCanvas(container.offsetWidth, container.offsetHeight);
}

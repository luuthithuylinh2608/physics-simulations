const canvas = document.getElementById('experimentCanvas');
const ctx = canvas.getContext('2d');
const workspace = document.getElementById('workspace');

let width, height, cx, cy;

// UI Elements
let state = {
    mirror: 'none',   // 'none', 'flat', 'rough'
    mirrorX: 0,
    ray: 'none',      // 'none', 'single', 'parallel'
    laser: { active: false, x: 0, y: 0 },
    protractor: { active: false, x: 0, y: 0, angle: 0, dragStartAngle: 0 },
    magnifier: { active: false, x: 0, y: 0 },
    incidentAngle: 45
};

let roughSegments = [];
let hitPoints = [];
let currentRaysData = [];
let mouseX = -100, mouseY = -100;
let draggingObject = null; // 'laser' or 'protractor'

// --- DRAG AND DROP UI ---
const toolItems = document.querySelectorAll('.tool-item');
toolItems.forEach(item => {
    item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('type', item.dataset.type);
    });
});

workspace.addEventListener('dragover', e => {
    e.preventDefault();
    workspace.classList.add('drag-over');
});

workspace.addEventListener('dragleave', e => {
    workspace.classList.remove('drag-over');
});

workspace.addEventListener('drop', e => {
    e.preventDefault();
    workspace.classList.remove('drag-over');

    const type = e.dataTransfer.getData('type');
    if (!type) return;

    const rect = canvas.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    if (type === 'mirror-flat') { state.mirror = 'flat'; state.mirrorX = dropX; }
    else if (type === 'mirror-rough') { state.mirror = 'rough'; state.mirrorX = dropX; updateRoughMirror(); }
    else if (type === 'ray-single') { state.ray = 'single'; state.laser.active = true; state.laser.x = dropX; state.laser.y = dropY; }
    else if (type === 'ray-parallel') { state.ray = 'parallel'; state.laser.active = true; state.laser.x = dropX; state.laser.y = dropY; }
    if (type === 'magnifier') {
        state.magnifier.active = true;
        state.magnifier.x = dropX;
        state.magnifier.y = dropY;
    }
    if (type === 'protractor') {
        state.protractor.active = true;
        let snapped = false;
        for (let hp of hitPoints) {
            if (Math.hypot(dropX - hp.x, dropY - hp.y) < 40) {
                state.protractor.x = hp.x;
                state.protractor.y = hp.y;
                state.protractor.angle = 0;
                snapped = true;
                break;
            }
        }
        if (!snapped) {
            let pX = state.mirror !== 'none' ? state.mirrorX : cx;
            if (Math.hypot(dropX - pX, dropY - cy) < 60) {
                state.protractor.x = pX;
                state.protractor.y = cy;
                state.protractor.angle = 0;
            } else {
                state.protractor.x = dropX;
                state.protractor.y = dropY;
            }
        }
    }
    updateSidebarIcons();
});

// Trash zone
const trashZone = document.getElementById('trash-zone');
trashZone.addEventListener('dragover', e => {
    e.preventDefault();
    trashZone.classList.add('drag-over');
});
trashZone.addEventListener('dragleave', e => {
    trashZone.classList.remove('drag-over');
});
trashZone.addEventListener('drop', e => {
    e.preventDefault();
    trashZone.classList.remove('drag-over');
    const type = e.dataTransfer.getData('type');
    if (type === 'mirror-flat' || type === 'mirror-rough') state.mirror = 'none';
    if (type === 'ray-single' || type === 'ray-parallel') { state.ray = 'none'; state.laser.active = false; }
    if (type === 'protractor') state.protractor.active = false;
    if (type === 'magnifier') state.magnifier.active = false;
    updateSidebarIcons();
});

function updateSidebarIcons() {
    const tools = {
        'mirror-flat': state.mirror === 'flat',
        'mirror-rough': state.mirror === 'rough',
        'ray-single': state.ray === 'single',
        'ray-parallel': state.ray === 'parallel',
        'protractor': state.protractor.active,
        'magnifier': state.magnifier.active
    };

    for (const [type, isActive] of Object.entries(tools)) {
        const el = document.querySelector(`.tool-item[data-type="${type}"]`);
        if (el) {
            el.style.display = isActive ? 'none' : 'flex';
        }
    }
}


// Khởi tạo
function init() {
    window.addEventListener('resize', resize);
    resize();
    setupEvents();
    requestAnimationFrame(draw);
}

function resize() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    cx = width / 2;
    cy = height * 0.65;
    if (state.mirrorX === 0) state.mirrorX = cx;
    updateRoughMirror();
}

function updateRoughMirror() {
    roughSegments = [];
    const startX = -450;
    const endX = 450;
    const steps = 45; // Number of zigzag segments
    let points = [];

    for (let i = 0; i <= steps; i++) {
        let x = startX + (endX - startX) * (i / steps);
        let bump = (Math.random() * 30 - 15);
        if (Math.abs(x) < 15) { x = 0; bump = 0; } // Ensure exactly hitting mirrorX, cy
        points.push({ x: state.mirrorX + x, y: cy + bump });
    }

    for (let i = 0; i < points.length - 1; i++) {
        let p1 = points[i], p2 = points[i + 1];
        let dx = p2.x - p1.x; let dy = p2.y - p1.y;
        let nx = -dy, ny = dx; // 90 deg rotation
        let len = Math.hypot(nx, ny);
        nx /= len; ny /= len;

        // make sure normal points UP (negative Y) because reflection comes from top
        if (ny > 0) { nx = -nx; ny = -ny; }

        roughSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, nx, ny });
    }
}

window.resetState = function () {
    state.mirror = 'none';
    state.ray = 'none';
    state.laser.active = false;
    state.protractor.active = false;
    state.protractor.angle = 0;
    state.magnifier.active = false;
    state.incidentAngle = 45;
    updateSidebarIcons();
}

function setupEvents() {
    // MOUSE EVENTS FOR DRAGGING
    canvas.addEventListener('pointerdown', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // 0. Kéo kính lúp (ưu tiên layer trên cùng)
        if (state.magnifier.active) {
            let distToMag = Math.hypot(mx - state.magnifier.x, my - state.magnifier.y);
            if (distToMag < 80) {
                draggingObject = 'magnifier';
                return;
            }
        }

        // 1. Thước đo góc
        if (state.protractor.active) {
            let px = state.protractor.x;
            let py = state.protractor.y;
            let dist = Math.hypot(mx - px, my - py);

            if (dist < 195) {
                draggingObject = 'protractor_move';
                return;
            } else if (dist >= 195 && dist <= 245) {
                draggingObject = 'protractor_rotate';
                let currentMouseAngle = Math.atan2(my - py, mx - px);
                state.protractor.dragStartAngle = currentMouseAngle - (state.protractor.angle || 0);
                return;
            }
        }

        // 2. Kéo đèn laser 
        if (state.laser.active) {
            let distToLaser = Math.hypot(mx - state.laser.x, my - state.laser.y);
            if (distToLaser < 75) {
                draggingObject = 'laser';
                return;
            }
        }

        // 3. Kéo gương
        if (state.mirror !== 'none') {
            if (Math.abs(my - cy) < 40 && Math.abs(mx - state.mirrorX) < 450) {
                draggingObject = 'mirror';
                return;
            }
        }
    });

    window.addEventListener('pointermove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        mouseX = mx;
        mouseY = my;

        if (!draggingObject) return;

        if (draggingObject === 'protractor_move') {
            let snapped = false;
            let closestDist = Infinity;
            let closestHp = null;

            for (let hp of hitPoints) {
                let d = Math.hypot(mx - hp.x, my - hp.y);
                if (d < 30 && d < closestDist) {
                    closestDist = d;
                    closestHp = hp;
                }
            }

            if (closestHp) {
                state.protractor.x = closestHp.x;
                state.protractor.y = closestHp.y;
                snapped = true;
            }

            if (!snapped) {
                let targetProtractorX = state.mirror !== 'none' ? state.mirrorX : cx;
                if (Math.hypot(mx - targetProtractorX, my - cy) < 40) {
                    state.protractor.x = targetProtractorX;
                    state.protractor.y = cy;
                } else {
                    state.protractor.x = mx;
                    state.protractor.y = my;
                }
            }
        } else if (draggingObject === 'protractor_rotate') {
            let currentMouseAngle = Math.atan2(my - state.protractor.y, mx - state.protractor.x);
            let newAngle = currentMouseAngle - state.protractor.dragStartAngle;
            // Snap to 0 if close
            if (Math.abs(newAngle % (Math.PI * 2)) < 0.08 || Math.abs(newAngle % (Math.PI * 2) - Math.PI * 2) < 0.08) {
                newAngle = 0;
            }
            state.protractor.angle = newAngle;
        } else if (draggingObject === 'magnifier') {
            state.magnifier.x = mx;
            state.magnifier.y = my;
        } else if (draggingObject === 'laser') {
            state.laser.x = mx;
            state.laser.y = my;
        } else if (draggingObject === 'mirror') {
            state.mirrorX = mx;
            if (state.mirror === 'rough') updateRoughMirror();
        }
    });

    window.addEventListener('pointerup', (e) => {
        const trashRect = trashZone.getBoundingClientRect();
        if (e.clientX >= trashRect.left && e.clientX <= trashRect.right &&
            e.clientY >= trashRect.top && e.clientY <= trashRect.bottom) {
            if (draggingObject === 'laser') {
                state.ray = 'none';
                state.laser.active = false;
            } else if (draggingObject === 'protractor_move' || draggingObject === 'protractor_rotate') {
                state.protractor.active = false;
            } else if (draggingObject === 'magnifier') {
                state.magnifier.active = false;
            } else if (draggingObject === 'mirror') {
                state.mirror = 'none';
            }
            updateSidebarIcons();
        }
        draggingObject = null;
    });
}

// ---------------------------------
// VẼ CANVAS
// ---------------------------------
function draw() {
    ctx.clearRect(0, 0, width, height);

    drawBoards();
    drawMirror();

    if (state.ray !== 'none') {
        drawLights(false);
    }

    if (state.protractor.active) {
        drawProtractor();
    }

    if (state.ray !== 'none' && currentRaysData.length > 0) {
        drawDataBoard();
    }

    // Kính lúp hiển thị đè lên tất cả
    if (state.magnifier.active) {
        drawMagnifier(state.magnifier.x, state.magnifier.y);
    }

    requestAnimationFrame(draw);
}

function drawDataBoard() {
    if (currentRaysData.length === 0) return;

    // Lấy góc của tia đầu tiên
    let { iVal, iPrimeVal } = currentRaysData[0];

    ctx.save();

    let w = 260;
    let h = 85;
    let bx = width - w - 30; // Top right
    let by = 30;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tiêu đề
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '700 15px Inter';
    ctx.fillText("BẢNG DỮ LIỆU ĐO", bx + w / 2, by + 12);

    // Vẽ vạch ngăn dọc
    ctx.beginPath();
    ctx.moveTo(bx + w / 2, by + 40);
    ctx.lineTo(bx + w / 2, by + 75);
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    // Thông số i
    ctx.font = '500 13px Inter';
    ctx.fillStyle = '#ef4444'; // Red for incident
    ctx.fillText(`Góc tới (i)`, bx + w / 4, by + 37);
    ctx.font = '700 16px Inter';
    ctx.fillText(`${iVal.toFixed(1)}°`, bx + w / 4, by + 57);

    // Thông số i'
    ctx.font = '500 13px Inter';
    ctx.fillStyle = '#3b82f6'; // Blue for reflection
    ctx.fillText(`Phản xạ (i')`, bx + 3 * w / 4, by + 37);
    ctx.font = '700 16px Inter';
    ctx.fillText(`${iPrimeVal.toFixed(1)}°`, bx + 3 * w / 4, by + 57);

    ctx.restore();
}

function drawMagnifier(mx, my) {
    ctx.save();

    // Clip area
    ctx.beginPath();
    ctx.arc(mx, my, 80, 0, Math.PI * 2);
    ctx.clip();

    // Tẩy trắng vùng kính
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(mx - 80, my - 80, 160, 160);

    ctx.translate(mx, my);
    ctx.scale(2.5, 2.5);
    ctx.translate(-mx, -my);

    drawBoards();
    drawMirror();
    if (state.ray !== 'none') drawLights(true);
    if (state.protractor.active) drawProtractor();

    ctx.restore();

    // Glass viền và tay cầm
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, 80, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.translate(mx, my);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(130, 0);
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(130, 0);
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#334155';
    ctx.stroke();
    ctx.restore();
}

function drawBoards() {
    // Top board layer
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, cy);

    // Bottom board layer
    ctx.fillStyle = '#e6e9ed';
    ctx.fillRect(0, cy, width, height - cy);

    // Horizontal dashed line (Mirror position / Ranh giới)
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Vertical dashed line (Pháp tuyến Normal)
    let mX = state.mirror !== 'none' ? state.mirrorX : cx;
    ctx.beginPath();
    ctx.moveTo(mX, 0);
    ctx.lineTo(mX, height);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawMirror() {
    if (state.mirror === 'none') return;

    ctx.save();
    if (state.mirror === 'flat') {
        // Flat Mirror
        ctx.beginPath();
        ctx.moveTo(state.mirrorX - 450, cy);
        ctx.lineTo(state.mirrorX + 450, cy);
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#94a3b8';
        for (let i = state.mirrorX - 430; i <= state.mirrorX + 430; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, cy);
            ctx.lineTo(i - 12, cy + 12);
            ctx.stroke();
        }
    } else {
        // Rough Mirror
        ctx.beginPath();
        if (roughSegments.length > 0) {
            ctx.moveTo(roughSegments[0].x1, roughSegments[0].y1);
            for (let s of roughSegments) {
                ctx.lineTo(s.x2, s.y2);
            }
        }
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#94a3b8';
        for (let i = 0; i < roughSegments.length; i += 2) {
            let sx = (roughSegments[i].x1 + roughSegments[i].x2) / 2;
            let sy = (roughSegments[i].y1 + roughSegments[i].y2) / 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - 8, sy + 15);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawProtractor() {
    let px = state.protractor.x;
    let py = state.protractor.y;
    let angle = state.protractor.angle || 0;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.arc(0, 0, 225, Math.PI, 0);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.65)'; // bán trong suốt
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(0, 0); ctx.stroke();

    // Center point (vòng tròn rỗng/dấu chấm)
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();

    // Đường pháp tuyến trên thước (90 góc)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -225);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Vạch chia
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 180; i += 5) {
        let rad = -i * Math.PI / 180;

        let startR = (i % 10 === 0) ? 210 : 217;
        ctx.beginPath();
        ctx.moveTo(startR * Math.cos(rad), startR * Math.sin(rad));
        ctx.lineTo(225 * Math.cos(rad), 225 * Math.sin(rad));
        ctx.strokeStyle = (i % 10 === 0) ? '#0f172a' : '#64748b';
        ctx.lineWidth = (i % 10 === 0) ? 2 : 1;
        ctx.stroke();

        if (i % 10 === 0) {
            // Vòng ngoài (Trái qua Phải: 0 ở trái, 180 ở phải)
            ctx.fillStyle = '#0f172a';
            ctx.font = '600 13px Inter';
            ctx.fillText(180 - i, 195 * Math.cos(rad), 195 * Math.sin(rad));

            // Vòng trong (Phải qua Trái: 0 ở phải, 180 ở trái)
            ctx.fillStyle = '#334155';
            ctx.font = '500 10px Inter';
            ctx.fillText(i, 175 * Math.cos(rad), 175 * Math.sin(rad));
        }
    }

    // Nút xoay viền (Visual indicator)
    ctx.beginPath();
    ctx.arc(225, 0, 8, 0, Math.PI * 2);
    ctx.arc(-225, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    ctx.restore();
}

function intersectLineSegment(px, py, vx, vy, x1, y1, x2, y2) {
    const v2x = x2 - x1;
    const v2y = y2 - y1;
    const cross = vx * v2y - vy * v2x;
    if (Math.abs(cross) < 1e-8) return null;

    const t1 = ((x1 - px) * v2y - (y1 - py) * v2x) / cross;
    const u = ((x1 - px) * vy - (y1 - py) * vx) / cross;

    if (u >= 0 && u <= 1 && t1 > 0) {
        return {
            t: t1,
            x: px + t1 * vx,
            y: py + t1 * vy
        };
    }
    return null;
}

function drawArrowPath(px, py, isBackwards = false) {
    let hl = 10, hw = 5;
    if (isBackwards) hl = -10;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - hl, py - hw);
    ctx.lineTo(px - hl, py + hw);
    ctx.closePath();
    ctx.fill();
}

function drawLights(isMagnifying = false) {
    if (!state.laser.active) return;
    let offsets = state.ray === 'parallel' ? [-31, -10, 10, 31] : [0];

    let sourceCenterX = state.laser.x;
    let sourceCenterY = state.laser.y;

    let targetX = state.mirror !== 'none' ? state.mirrorX : cx;
    let targetY = cy;
    let dx = targetX - sourceCenterX;
    let dy = targetY - sourceCenterY;
    let dist = Math.hypot(dx, dy);

    // Default to pointing right if exactly at center
    if (dist < 1) { dx = 1; dy = 0; dist = 1; }

    let dirX = dx / dist;
    let dirY = dy / dist;

    // Laser Device Box
    ctx.save();
    ctx.translate(sourceCenterX, sourceCenterY);
    ctx.rotate(Math.atan2(dirY, dirX));

    ctx.fillStyle = '#1e293b';
    if (state.ray === 'parallel') {
        ctx.beginPath();
        ctx.roundRect(-45, -52, 90, 105, 9);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(45, -39 + i * 21, 12, 6);
        }
    } else {
        ctx.beginPath();
        ctx.roundRect(-37, -18, 75, 36, 9);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(37, -6, 12, 12);
    }
    // Hover/Drag indication
    if (draggingObject === 'laser') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-60, -60, 120, 120);
    }
    ctx.restore();

    // Raycasting
    let perpX = -dirY;
    let perpY = dirX;

    if (!isMagnifying) {
        hitPoints = []; // Đặt lại sau mỗi frame để lấy chính xác mảng ánh sáng mới
        currentRaysData = [];
    }

    for (let off of offsets) {
        let ox = sourceCenterX + perpX * off;
        let oy = sourceCenterY + perpY * off;

        // Find Intersection
        let hitX, hitY, hitNX, hitNY;

        if (state.mirror === 'flat') {
            if (Math.abs(dirY) > 1e-5) {
                let t = (cy - oy) / dirY;
                // Nếu chiếu cùng phía với mặt sau gương (giả sử phía dưới là mặt sau), ta vẫn cho phản xạ
                hitX = ox + t * dirX;
                hitY = cy;
                hitNX = 0; hitNY = (dirY > 0) ? -1 : 1;
            }
        } else if (state.mirror === 'rough') {
            let minT = Infinity;
            for (let seg of roughSegments) {
                let inter = intersectLineSegment(ox, oy, dirX, dirY, seg.x1, seg.y1, seg.x2, seg.y2);
                if (inter && inter.t > 1e-4 && inter.t < minT) {
                    minT = inter.t;
                    hitX = inter.x;
                    hitY = inter.y;
                    hitNX = seg.nx;
                    hitNY = seg.ny;
                    // Flip normal if it points same direction as ray
                    if (dirX * hitNX + dirY * hitNY > 0) {
                        hitNX = -hitNX;
                        hitNY = -hitNY;
                    }
                }
            }
        } else {
            // Không có gương thì tia chiếu xuyên qua
            let t = 1500;
            hitX = ox + t * dirX;
            hitY = oy + t * dirY;
        }

        if (hitX && hitY) {
            // Incident Ray
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(hitX, hitY);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = state.ray === 'single' ? 3.5 : 2;
            ctx.stroke();

            // Incident Arrow
            let midX = ox + (hitX - ox) * 0.4;
            let midY = oy + (hitY - oy) * 0.4;
            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(Math.atan2(dirY, dirX));
            ctx.fillStyle = '#ef4444';
            drawArrowPath(0, 0, false);
            ctx.restore();

            // Reflection
            if (state.mirror !== 'none' && hitNX !== undefined) {
                let dot = dirX * hitNX + dirY * hitNY;
                let angle = Math.acos(Math.abs(dot)) * 180 / Math.PI;

                if (!isMagnifying) {
                    hitPoints.push({ x: hitX, y: hitY }); // Lưu điểm tới để thước hít vào
                    currentRaysData.push({ iVal: angle, iPrimeVal: angle });
                }

                // Vẽ pháp tuyến mờ cho gương gồ ghề
                if (state.mirror === 'rough') {
                    ctx.beginPath();
                    ctx.moveTo(hitX, hitY);
                    ctx.lineTo(hitX + hitNX * 80, hitY + hitNY * 80);
                    ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                let rx = dirX - 2 * dot * hitNX;
                let ry = dirY - 2 * dot * hitNY;

                let Dout = 1000;
                let endX = hitX + rx * Dout;
                let endY = hitY + ry * Dout;

                ctx.beginPath();
                ctx.moveTo(hitX, hitY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = `rgba(239, 68, 68, 1)`;
                ctx.lineWidth = state.ray === 'single' ? 3.5 : 2;
                ctx.stroke();

                let midRX = hitX + rx * 200;
                let midRY = hitY + ry * 200;
                ctx.save();
                ctx.translate(midRX, midRY);
                ctx.rotate(Math.atan2(ry, rx));
                ctx.fillStyle = `rgba(239, 68, 68, 1)`;
                drawArrowPath(0, 0, false);
                ctx.restore();
            }
        }
    }
}

init();

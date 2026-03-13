const canvas = document.getElementById('freefallCanvas');
const ctx = canvas.getContext('2d');

const initialHeight = 60; // Chiều cao ban đầu tính bằng mét
const scale = canvas.height / initialHeight; // Tỷ lệ chuyển đổi từ mét sang pixel

const planets = {
    "Trái đất": 9.81,
    "Sao Hỏa": 3.71,
    "Mặt trăng": 1.62,
    "Sao Mộc": 24.79
};

let currentPlanetG = null;
let position = initialHeight;
let time = 0;
let animationFrameId = null;

// Hàm để vẽ mọi thứ lên canvas
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Xóa canvas

    // Vẽ các vạch chia độ cao (từ 0m đến 60m)
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    for (let h = 0; h <= initialHeight; h += 20) {
        const y = canvas.height - (h * scale);
        ctx.fillText(`${h}m`, 5, y - 5);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.strokeStyle = '#ccc';
        ctx.stroke();
    }
    
    // Vẽ mặt đất
    ctx.fillStyle = '#6B8E23'; // Màu xanh ô liu
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    // Vẽ vật rơi nếu thí nghiệm đang chạy
    if (currentPlanetG !== null) {
        const yPos = canvas.height - (position * scale);
        ctx.beginPath();
        ctx.arc(canvas.width / 2, yPos, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'orange';
        ctx.fill();
    }
}

// Hàm cập nhật vị trí của vật rơi
function update() {
    if (currentPlanetG !== null) {
        position = initialHeight - 0.5 * currentPlanetG * Math.pow(time, 2);
        time += 0.05; // Tăng thời gian sau mỗi khung hình

        if (position <= 0) {
            position = 0; // Đảm bảo vật không rơi xuống dưới mặt đất
            cancelAnimationFrame(animationFrameId); // Dừng hoạt ảnh
        }
    }
}

// Vòng lặp chính để tạo hoạt ảnh
function gameLoop() {
    update();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Tạo các nút bấm cho từng hành tinh
const buttonsContainer = document.querySelector('.buttons-container');
for (const planetName in planets) {
    const button = document.createElement('button');
    button.textContent = `${planetName}: ${planets[planetName]} m/s²`;
    button.addEventListener('click', () => {
        // Khi bấm nút, reset và bắt đầu lại hoạt ảnh
        cancelAnimationFrame(animationFrameId);
        currentPlanetG = planets[planetName];
        position = initialHeight;
        time = 0;
        gameLoop();
    });
    buttonsContainer.appendChild(button);
}

// Khởi chạy vòng lặp lần đầu để vẽ màn hình ban đầu
draw();

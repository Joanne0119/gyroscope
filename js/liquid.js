const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 40,
  color: "rgb(33, 150, 243)",
  vx: 0,
  vy: 0
};

let ax = 0;
let ay = 0;

// Handle phone tilt
window.addEventListener("deviceorientation", e => {
  ax = e.gamma / 30; // left-right tilt (-90 to 90)
  ay = e.beta / 30;  // front-back tilt (-180 to 180)
});

// Physics loop
function update() {
  ball.vx += ax;  // add acceleration
  ball.vy += ay;

  // Friction
  ball.vx *= 0.98;
  ball.vy *= 0.98;

  // Update position
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Bounce off edges
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx *= -0.8;
  }
  if (ball.x + ball.radius > canvas.width) {
    ball.x = canvas.width - ball.radius;
    ball.vx *= -0.8;
  }
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.vy *= -0.8;
  }
  if (ball.y + ball.radius > canvas.height) {
    ball.y = canvas.height - ball.radius;
    ball.vy *= -0.8;
  }
}

// Draw ball
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();
}

// Animation loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
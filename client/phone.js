let socket;
let tracking = false;
let lastTimestamp = 0;
let quaternion = { x: 0, y: 0, z: 0, w: 1 };
let calibrationQuaternion = { x: 0, y: 0, z: 0, w: 1 };
let position = { x: 0, y: 0, z: 0 };
let velocity = { x: 0, y: 0, z: 0 };
let filteredAccel = { x: 0, y: 0, z: 0 };
let lastCalibrationTime = 0;
const CALIBRATION_INTERVAL = 600000; // 10 minutes
const GRAVITY = 0; // m/s^2
const ACCELERATION_THRESHOLD = 0.05; // m/s^2
const ZUPT_WINDOW = 10; // Number of samples to check for zero velocity
let recentAccelerations = [];

const kalmanFilterX = createKalmanFilter(0.001, 0.3);
const kalmanFilterY = createKalmanFilter(0.001, 0.3);
const kalmanFilterZ = createKalmanFilter(0.001, 0.3);

function createKalmanFilter(q, r) {
    return {
        Q: q, // process noise covariance
        R: r, // measurement noise covariance
        P: 1,
        x: 0,
        K: 0,

        update: function (measurement) {
            this.P = this.P + this.Q;
            this.K = this.P / (this.P + this.R);
            this.x = this.x + this.K * (measurement - this.x);
            this.P = (1 - this.K) * this.P;
            return this.x;
        }
    };
}

function connectWebSocket(token) {
    socket = io('https://phone-tracking-v2.onrender.com', { 
        auth: { token: token }
    });

    socket.on('recalibrate', () => {
        console.log('Received recalibration command from server');
        calibrate();
    });

    socket.on('connect', () => { 
        document.getElementById('status').innerText = 'Connected to server'; 
    });
    socket.on('connect_error', (error) => { 
        document.getElementById('status').innerText = 'Connection error: ' + error.message; 
        console.error('Connection error:', error); 
    });
    socket.on('disconnect', () => { 
        document.getElementById('status').innerText = 'Disconnected from server'; 
    });
}

function toggleTracking() {
    tracking ? stopTracking() : startTracking();
}

function startTracking() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(response => { 
            if (response === 'granted') initSensors(); 
        });
    } else { 
        initSensors(); 
    }
}

function stopTracking() {
    window.removeEventListener('devicemotion', handleMotion);
    tracking = false;
    document.getElementById('status').innerText = 'Not sending data';
}

function handleMotion(event) {
    if (!tracking) return;

    const timestamp = event.timeStamp;
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    const gyro = {
        x: event.rotationRate.alpha * Math.PI / 180,
        y: event.rotationRate.beta * Math.PI / 180,
        z: event.rotationRate.gamma * Math.PI / 180
    };

    const accel = {
        x: event.acceleration.x || 0,
        y: event.acceleration.y || 0,
        z: event.acceleration.z || 0
    };

    // Apply high-pass filter to acceleration
    filteredAccel = highPassFilter(accel, filteredAccel, 0.4);

    // Update quaternion
    const deltaQuat = calculateDeltaQuaternion(gyro, dt);
    quaternion = multiplyQuaternions(quaternion, deltaQuat);

    const calibratedQuaternion = multiplyQuaternions(calibrationQuaternion, quaternion);

    // Remove gravity and apply additional filtering
    const gravityFree = removeGravity(filteredAccel, calibratedQuaternion);
    const filteredGravityFree = {
        x: kalmanFilterX.update(gravityFree.x),
        y: kalmanFilterY.update(gravityFree.y),
        z: kalmanFilterZ.update(gravityFree.z)
    };

    // Zero Velocity Update (ZUPT)
    recentAccelerations.push(filteredGravityFree);
    if (recentAccelerations.length > ZUPT_WINDOW) {
        recentAccelerations.shift();
    }

    if (isDeviceStationary(recentAccelerations)) {
        velocity = { x: 0, y: 0, z: 0 };
    } else {
        // Update velocity and position
        velocity.x += filteredGravityFree.x * dt;
        velocity.y += filteredGravityFree.y * dt;
        velocity.z += filteredGravityFree.z * dt;
    }

    velocity.x *= 0.95;
    velocity.y *= 0.95;
    velocity.z *= 0.95;

    position.x += velocity.x * dt + 0.5 * filteredGravityFree.x * dt * dt;
    position.y += velocity.y * dt + 0.5 * filteredGravityFree.y * dt * dt;
    position.z += velocity.z * dt + 0.5 * filteredGravityFree.z * dt * dt;

    position.x *= 0.95;
    position.y *= 0.95;
    position.z *= 0.95;

    // Apply Kalman filter to position
    const kalmanEstimate = {
        x: kalmanFilterX.update(position.x),
        y: kalmanFilterY.update(position.y),
        z: kalmanFilterZ.update(position.z)
    };

    sendSensorData(calibratedQuaternion, kalmanEstimate);

    if (timestamp - lastCalibrationTime > CALIBRATION_INTERVAL) {
        calibrate();
        lastCalibrationTime = timestamp;
    }

    updateDebugInfo(kalmanEstimate, filteredGravityFree);
}

function highPassFilter(input, lastOutput, alpha) {
    return {
        x: alpha * (lastOutput.x + input.x - lastOutput.x),
        y: alpha * (lastOutput.y + input.y - lastOutput.y),
        z: alpha * (lastOutput.z + input.z - lastOutput.z)
    };
}

function isDeviceStationary(accelerations) {
    const avgAcceleration = accelerations.reduce((sum, acc) => ({
        x: sum.x + Math.abs(acc.x),
        y: sum.y + Math.abs(acc.y),
        z: sum.z + Math.abs(acc.z)
    }), { x: 0, y: 0, z: 0 });

    const avgMagnitude = Math.sqrt(
        (avgAcceleration.x * avgAcceleration.x + 
         avgAcceleration.y * avgAcceleration.y + 
         avgAcceleration.z * avgAcceleration.z) / accelerations.length
    );

    return avgMagnitude < ACCELERATION_THRESHOLD;
}

function updateDebugInfo(position, acceleration) {
    const debugElement = document.getElementById('debug');
    debugElement.innerHTML = `
        Position:<br>
        X: ${position.x.toFixed(2)}<br>
        Y: ${position.y.toFixed(2)}<br>
        Z: ${position.z.toFixed(2)}<br>
        Acceleration:<br>
        X: ${acceleration.x.toFixed(2)}<br>
        Y: ${acceleration.y.toFixed(2)}<br>
        Z: ${acceleration.z.toFixed(2)}
    `;
}

function calculateAccelQuaternion(accel) {
    const norm = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
    if (norm === 0) return { w: 1, x: 0, y: 0, z: 0 };
    const gravity = { x: accel.x / norm, y: accel.y / norm, z: accel.z / norm };
    const angle = Math.acos(gravity.z);
    const axis = normalizeVector({ x: gravity.y, y: -gravity.x, z: 0 });
    const sinHalfAngle = Math.sin(angle / 2);
    return normalizeQuaternion({ 
        w: Math.cos(angle / 2), 
        x: axis.x * sinHalfAngle, 
        y: axis.y * sinHalfAngle, 
        z: axis.z * sinHalfAngle 
    });
}

function removeGravity(accel, quaternion) {
    const gravity = { x: 0, y: 0, z: GRAVITY };
    const rotatedGravity = rotateVectorByQuaternion(gravity, quaternion);
    return {
        x: accel.x - rotatedGravity.x,
        y: accel.y - rotatedGravity.y,
        z: accel.z - rotatedGravity.z
    };
}

function rotateVectorByQuaternion(v, q) {
    const rotatedV = multiplyQuaternions(
        multiplyQuaternions(q, {w: 0, x: v.x, y: v.y, z: v.z}),
        invertQuaternion(q)
    );
    return {x: rotatedV.x, y: rotatedV.y, z: rotatedV.z};
}

function calibrate() {
    calibrationQuaternion = invertQuaternion(quaternion);
    position = { x: 0, y: 0, z: 0 };
    velocity = { x: 0, y: 0, z: 0 };
    kalmanFilterX.x = 0;
    kalmanFilterY.x = 0;
    kalmanFilterZ.x = 0;
}

function calculateDeltaQuaternion(gyro, dt) {
    const angle = Math.sqrt(gyro.x * gyro.x + gyro.y * gyro.y + gyro.z * gyro.z) * dt;
    const axis = normalizeVector(gyro);
    const sinHalfAngle = Math.sin(angle / 2);
    return normalizeQuaternion({ 
        w: Math.cos(angle / 2), 
        x: axis.x * sinHalfAngle, 
        y: axis.y * sinHalfAngle, 
        z: axis.z * sinHalfAngle 
    });
}

function invertQuaternion(q) {
    const norm = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    return { w: q.w / norm, x: -q.x / norm, y: -q.y / norm, z: -q.z / norm };
}

function multiplyQuaternions(q1, q2) {
    return normalizeQuaternion({ 
        w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z, 
        x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y, 
        y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x, 
        z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w 
    });
}

function normalizeQuaternion(q) {
    const norm = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    if (norm === 0) return { w: 1, x: 0, y: 0, z: 0 };
    return { w: q.w / norm, x: q.x / norm, y: q.y / norm, z: q.z / norm };
}

function normalizeVector(v) {
    const magnitude = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (magnitude === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / magnitude, y: v.y / magnitude, z: v.z / magnitude };
}

function sendSensorData(calibratedQuaternion, position) {
    if (socket && socket.connected) {
        socket.emit('sensorData', { quaternion: calibratedQuaternion, position: position });
    }
}

function initSensors() {
    window.addEventListener('devicemotion', handleMotion);
    tracking = true;
    document.getElementById('status').innerText = 'Sending data';
}

connectWebSocket('your_test_token');

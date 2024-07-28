import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.112/examples/jsm/loaders/GLTFLoader.js';

let socket;
let scene, camera, renderer, deviceModel, headModel;
let currentModel;
let useHeadModel = false;
let motionData = [];
let recording = false;

function recordMotion(data) {
    if (data.quaternion && data.position) {
        motionData.push({
            timestamp: Date.now(),
            quaternion: data.quaternion,
            position: data.position
        });
    }
}

function saveMotionData() {
    const json = JSON.stringify(motionData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motion_data.json';
    a.click();
    URL.revokeObjectURL(url);
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    // Create a smaller box model
    const geometry = new THREE.BoxGeometry(0.1, 0.2, 0.01);
    const materials = [
        new THREE.MeshBasicMaterial({ color: 0x007bff, wireframe: true }),
        new THREE.MeshBasicMaterial({ color: 0x007bff, wireframe: true }),
        new THREE.MeshBasicMaterial({ color: 0x007bff, wireframe: true }),
        new THREE.MeshBasicMaterial({ color: 0x007bff, wireframe: true }),
        new THREE.MeshBasicMaterial({ color: 0x007bff, wireframe: true }),
        new THREE.MeshBasicMaterial({ color: 0x007bff, wireframe: true })
    ];
    deviceModel = new THREE.Mesh(geometry, materials);
    scene.add(deviceModel);
    currentModel = deviceModel;

    const loader = new GLTFLoader();
    loader.load(
        'head.glb',
        function (gltf) {
            console.log('GLTF model loaded successfully');
            headModel = gltf.scene;
            
            headModel.traverse((node) => {
                if (node.isMesh) {
                    if (!node.material.customProgramCacheKey) {
                        node.material = new THREE.MeshPhongMaterial({ color: 0x808080 });
                    }
                }
            });

            headModel.scale.set(0.5, 0.5, 0.5);
            headModel.position.set(0, 0, 0);
            scene.add(headModel);
            headModel.visible = false;

            const box = new THREE.Box3().setFromObject(headModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            camera.position.copy(center);
            camera.position.z += maxDim * 2;
            camera.lookAt(center);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.error('An error happened', error);
        }
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    window.addEventListener('resize', onWindowResize, false);
    document.getElementById('toggleModelButton').addEventListener('click', toggleModel);
    
    animate();
}

function toggleModel() {
    useHeadModel = !useHeadModel;
    if (useHeadModel && headModel) {
        deviceModel.visible = false;
        headModel.visible = true;
        currentModel = headModel;
        console.log('Switched to head model');
    } else {
        deviceModel.visible = true;
        headModel.visible = false;
        currentModel = deviceModel;
        console.log('Switched to box model');
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    var saveButton = document.getElementById("saveButton")
}

function connectWebSocket(token) {
    socket = io('https://phone-tracking-v2.onrender.com', { auth: { token: token } });

    socket.on('connect', () => { document.getElementById('status').innerText = 'Connected to server'; });
    socket.on('connect_error', (error) => { document.getElementById('status').innerText = 'Connection error: ' + error.message; console.error('Connection error:', error); });
    socket.on('disconnect', () => { document.getElementById('status').innerText = 'Disconnected from server'; });

    socket.on('sensorData', (data) => {
        updateVisualization(data);
        if(recording){
            recordMotion(data);
        }
        if(motionData.length > 0){
            saveButton.removeAttribute("disabled")
        } else {
            saveButton.setAttribute("disabled", "")
        }
    });

    document.getElementById('recalibrateButton').addEventListener('click', () => {
        socket.emit('recalibrate');
        console.log('Recalibration command sent');
    });
    var saveButton = document.getElementById("saveButton")
    saveButton.addEventListener('click', () => {
        saveMotionData()
    });

    var recordButton = document.getElementById('toggleRecordButton')
    recordButton.addEventListener('click', () => {
        if (recording){
            recording = false;
            recordButton.innerText = "Start Recording"
        } else {
            recording = true;
            saveButton.disabled = false;
            saveButton.removeAttribute("disabled")
            console.log(saveButton.attributes.disabled)
            recordButton.innerText = "Stop Recording"
        }
    })
}

function updateVisualization(data) {
    if (data.quaternion && currentModel) {
        // Convert the quaternion to match the desired orientation
        const q = new THREE.Quaternion(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
        
        // Create a rotation that aligns the phone's "up" (Y-axis when lying flat) with the world "forward" (negative Z-axis)
        const alignmentRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI, 0));
        
        // Apply the alignment rotation to the received quaternion
        q.premultiply(alignmentRotation);
        
        // Apply a rotation to invert the pitch axis
        const invertPitchRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
        q.multiply(invertPitchRotation);

        // Apply a base rotation to correct the initial orientation of the model's head
        const baseRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2, Math.PI, 0)); // Adjust as needed
        q.multiply(baseRotation);

        currentModel.quaternion.copy(q);
    }

    if (data.position && currentModel) {
        // currentModel.position.set(data.position.x, data.position.y, data.position.z);
    }
}

init();
connectWebSocket('your_test_token');

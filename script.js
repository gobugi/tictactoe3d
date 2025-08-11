import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Game Colors
const COLORS = {
    WHITE: 0xFFFFFF,
    RED: 0xFF0000,
    BLUE: 0x0000FF,
    BLACK: 0x000000
};

// Game state
let currentPlayer = 1; // 1 for red, 2 for blue
let gameBoard = new Array(27).fill(0); // 3x3x3 = 27 positions
let gameEnded = false;
let firstMoveMade = false;

// Three.js setup
let scene, camera, renderer, cubeGroup;
let cubePieces = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let controls;
let centerAura = null; // For the center cube aura effect

// Center cube button replacement - now with two cubes
let centerCubes = {
    player1: {
        scene: null,
        camera: null,
        renderer: null,
        group: null,
        inner: null,
        outer: null
    },
    player2: {
        scene: null,
        camera: null,
        renderer: null,
        group: null,
        inner: null,
        outer: null
    }
};
let isFadingOut = false;

// Click detection variables
let mouseDownTime = 0;
let mouseDownPosition = new THREE.Vector2();
let isDragging = false;

function init() {
    // Create scene with transparent background
    scene = new THREE.Scene();
    // Remove scene background to allow HTML background to show through
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    
    // Create renderer with transparent background
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0); // Transparent background
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Add lights
    setupLighting();
    
    // Create the Rubik's cube
    createRubiksCube();
    
    // Add orbit controls for manual rotation
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 3;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI;
    
    // Create both center cube 3D buttons
    createCenterCubeButtons();
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    
    // Start animation loop
    animate();
    
    // Initialize UI to show current player
    updateUI();
    updateCenterCubeButtons();
}

function setupLighting() {
    // Much brighter ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Bright main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Brighter fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-5, -5, -2);
    scene.add(fillLight);
    
    // Additional top light to brighten stickers
    const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);
    
    // Side lights for even illumination
    const leftLight = new THREE.DirectionalLight(0xffffff, 0.3);
    leftLight.position.set(-10, 0, 0);
    scene.add(leftLight);
    
    const rightLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rightLight.position.set(10, 0, 0);
    scene.add(rightLight);
}

function createRubiksCube() {
    cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    
    const cubeSize = 0.95; // Slightly smaller than 1 to create gaps
    const gap = 0.05;
    
    // Create 3x3x3 grid of cubes
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            for (let z = 0; z < 3; z++) {
                const position = new THREE.Vector3(
                    (x - 1) * (cubeSize + gap),
                    (y - 1) * (cubeSize + gap),
                    (z - 1) * (cubeSize + gap)
                );
                
                const cubeIndex = x * 9 + y * 3 + z;
                const cube = createSingleCube(cubeSize, position, cubeIndex);
                cubeGroup.add(cube);
                cubePieces.push(cube);
            }
        }
    }
}

function createRoundedBoxGeometry(width, height, depth, radius, smoothness) {
    // Create a rounded box geometry
    const shape = new THREE.Shape();
    const eps = 0.00001;
    const radius0 = radius - eps;
    
    shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
    shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true);
    shape.absarc(width - radius * 2, height - radius * 2, eps, Math.PI / 2, 0, true);
    shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true);
    
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: depth - radius * 2,
        bevelEnabled: true,
        bevelSegments: smoothness * 2,
        steps: 1,
        bevelSize: radius,
        bevelThickness: radius,
        curveSegments: smoothness
    });
    
    geometry.center();
    return geometry;
}

function createRoundedRectangleGeometry(width, height, radius) {
    // Create a rounded rectangle shape for stickers
    const shape = new THREE.Shape();
    
    const x = -width / 2;
    const y = -height / 2;
    
    shape.moveTo(x, y + radius);
    shape.lineTo(x, y + height - radius);
    shape.quadraticCurveTo(x, y + height, x + radius, y + height);
    shape.lineTo(x + width - radius, y + height);
    shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
    shape.lineTo(x + width, y + radius);
    shape.quadraticCurveTo(x + width, y, x + width - radius, y);
    shape.lineTo(x + radius, y);
    shape.quadraticCurveTo(x, y, x, y + radius);
    
    const geometry = new THREE.ShapeGeometry(shape);
    return geometry;
}

function createSingleCube(size, position, index) {
    // Create rounded geometry for more realistic look
    const roundRadius = 0.1; // Rounded corners
    const geometry = createRoundedBoxGeometry(size, size, size, roundRadius, 2);
    
    // Create black base cube materials  
    const materials = [
        new THREE.MeshPhongMaterial({ 
            color: COLORS.BLACK, 
            shininess: 30,
            specular: 0x111111
        }), // Right
        new THREE.MeshPhongMaterial({ 
            color: COLORS.BLACK, 
            shininess: 30,
            specular: 0x111111
        }), // Left
        new THREE.MeshPhongMaterial({ 
            color: COLORS.BLACK, 
            shininess: 30,
            specular: 0x111111
        }), // Top
        new THREE.MeshPhongMaterial({ 
            color: COLORS.BLACK, 
            shininess: 30,
            specular: 0x111111
        }), // Bottom
        new THREE.MeshPhongMaterial({ 
            color: COLORS.BLACK, 
            shininess: 30,
            specular: 0x111111
        }), // Front
        new THREE.MeshPhongMaterial({ 
            color: COLORS.BLACK, 
            shininess: 30,
            specular: 0x111111
        })  // Back
    ];
    
    // Create cube mesh
    const cube = new THREE.Mesh(geometry, materials);
    cube.position.copy(position);
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    // Store index for game logic
    cube.userData = { index: index, claimed: false, stickers: [] };
    
    // Add white stickers on each face
    addStickers(cube, size);
    
    // Add black edges for realistic Rubik's cube look
    addBlackEdges(cube, size);
    
    return cube;
}

function addStickers(cube, size) {
    // Create white stickers on each face
    const stickerSize = size * 0.8; // Slightly smaller than cube face
    const offset = size / 2 + 0.01; // Small offset to prevent z-fighting
    
    const stickerMaterial = new THREE.MeshPhongMaterial({
        color: COLORS.WHITE,
        shininess: 100,
        specular: 0x222222
    });
    
    // Face positions and rotations for stickers
    const faces = [
        { pos: [offset, 0, 0], rot: [0, Math.PI/2, 0] }, // Right
        { pos: [-offset, 0, 0], rot: [0, -Math.PI/2, 0] }, // Left
        { pos: [0, offset, 0], rot: [-Math.PI/2, 0, 0] }, // Top
        { pos: [0, -offset, 0], rot: [Math.PI/2, 0, 0] }, // Bottom
        { pos: [0, 0, offset], rot: [0, 0, 0] }, // Front
        { pos: [0, 0, -offset], rot: [0, Math.PI, 0] } // Back
    ];
    
    faces.forEach((face, index) => {
        const stickerGeometry = createRoundedRectangleGeometry(stickerSize, stickerSize, 0.05);
        const sticker = new THREE.Mesh(stickerGeometry, stickerMaterial.clone());
        
        sticker.position.set(...face.pos);
        sticker.rotation.set(...face.rot);
        sticker.userData = { faceIndex: index };
        
        cube.add(sticker);
        cube.userData.stickers.push(sticker);
    });
}

function addBlackEdges(cube, size) {
    // Add subtle black wireframe edges like a real Rubik's cube
    const edgesGeometry = new THREE.EdgesGeometry(cube.geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ 
        color: COLORS.BLACK,
        linewidth: 2
    });
    
    const wireframe = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cube.add(wireframe);
}

function onMouseDown(event) {
    if (event.button !== 0) return; // Only handle left mouse button
    
    mouseDownTime = Date.now();
    mouseDownPosition.set(event.clientX, event.clientY);
    isDragging = false;
}

function onMouseMove(event) {
    if (mouseDownTime > 0) {
        // Check if mouse has moved significantly since mousedown
        const currentPos = new THREE.Vector2(event.clientX, event.clientY);
        const distance = mouseDownPosition.distanceTo(currentPos);
        
        if (distance > 5) { // 5 pixel threshold
            isDragging = true;
        }
    }
}

function onMouseUp(event) {
    if (event.button !== 0 || gameEnded) return; // Only handle left mouse button
    
    const clickDuration = Date.now() - mouseDownTime;
    
    // Only treat as a click if:
    // 1. Click duration is less than 200ms (quick click)
    // 2. Mouse hasn't moved significantly (not dragging)
    if (clickDuration < 200 && !isDragging) {
        handleCubeClick(event);
    }
    
    // Reset tracking variables
    mouseDownTime = 0;
    isDragging = false;
}

function handleCubeClick(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray - include all children (stickers)
    const allClickableObjects = [];
    cubePieces.forEach(cube => {
        allClickableObjects.push(...cube.userData.stickers);
        allClickableObjects.push(cube);
    });
    
    const intersects = raycaster.intersectObjects(allClickableObjects, false);
    
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        
        // Find the parent cube
        let targetCube = clickedObject;
        if (clickedObject.userData.faceIndex !== undefined) {
            // Clicked on a sticker, get parent cube
            targetCube = clickedObject.parent;
        } else if (!targetCube.userData.hasOwnProperty('index')) {
            // Clicked on something else, try to find parent cube
            while (targetCube.parent && !targetCube.userData.hasOwnProperty('index')) {
                targetCube = targetCube.parent;
            }
        }
        
        if (targetCube.userData && !targetCube.userData.claimed) {
            claimCube(targetCube);
        }
    }
}

function onCenterCubeClick() {
    if (gameEnded || isFadingOut) return;
    
    const centerCubeIndex = 13; // Center cube in 3x3x3 grid (position [1,1,1])
    
    // Check if center cube is already claimed
    if (gameBoard[centerCubeIndex] !== 0) return;
    
    // Get the current player's color before claiming (since claimCube switches players)
    const playerColor = currentPlayer === 1 ? COLORS.RED : COLORS.BLUE;
    
    // Start fade animations
    startFadeAnimations(playerColor, centerCubeIndex);
}

function startFadeAnimations(playerColor, centerCubeIndex) {
    isFadingOut = true;
    const fadeDuration = 1000; // 1 second
    const startTime = Date.now();
    
    // Start background glow fade-in
    fadeInBackgroundGlow(playerColor, fadeDuration);
    
    // Start cube fade-out for both cubes
    fadeOutCenterCubes(fadeDuration, () => {
        // Callback when fade is complete
        const centerCube = cubePieces[centerCubeIndex];
        claimCube(centerCube);
        updateCenterCubeButtons();
    });
}

function fadeInBackgroundGlow(playerColor, duration) {
    const backgroundGlow = document.getElementById('background-glow');
    if (!backgroundGlow) return;
    
    const colorHex = playerColor === COLORS.RED ? '#ff0000' : '#0000ff';
    const startTime = Date.now();
    
    // Show element immediately but fully transparent
    backgroundGlow.style.background = `radial-gradient(circle at center, ${colorHex} 0%, ${colorHex}aa 15%, ${colorHex}66 30%, ${colorHex}33 45%, transparent 60%)`;
    backgroundGlow.style.display = 'block';
    backgroundGlow.style.opacity = '0';
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in-out for smooth animation
        const easeProgress = 0.5 * (1 - Math.cos(Math.PI * progress));
        backgroundGlow.style.opacity = (0.8 * easeProgress).toString();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

function fadeOutCenterCubes(duration, callback) {
    const startTime = Date.now();
    const startOpacity = 1;
    
    // Set all materials to transparent mode at start for both cubes
    Object.values(centerCubes).forEach(cube => {
        if (cube.group) {
            cube.group.children.forEach(child => {
                if (child.material) {
                    child.material.transparent = true;
                    child.material.opacity = 1;
                    child.material.needsUpdate = true;
                }
            });
        }
    });
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in-out for smooth animation
        const easeProgress = 0.5 * (1 - Math.cos(Math.PI * progress));
        const opacity = startOpacity * (1 - easeProgress);
        
        // Update opacity for all children in both cubes
        Object.values(centerCubes).forEach(cube => {
            if (cube.group) {
                cube.group.children.forEach(child => {
                    if (child.material) {
                        child.material.opacity = opacity;
                        child.material.needsUpdate = true;
                    }
                });
            }
        });
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete - hide both cube containers
            document.getElementById('center-cube-container-1').style.display = 'none';
            document.getElementById('center-cube-container-2').style.display = 'none';
            callback();
        }
    }
    
    requestAnimationFrame(animate);
}

function createCenterAura(playerColor) {
    // Remove existing aura if it exists
    if (centerAura) {
        scene.remove(centerAura);
    }
    
    // Show the background glow with appropriate color
    const backgroundGlow = document.getElementById('background-glow');
    if (backgroundGlow) {
        const colorHex = playerColor === COLORS.RED ? '#ff0000' : '#0000ff';
        backgroundGlow.style.background = `radial-gradient(circle at center, ${colorHex} 0%, ${colorHex}aa 15%, ${colorHex}66 30%, ${colorHex}33 45%, transparent 60%)`;
        backgroundGlow.style.display = 'block';
        console.log('Background glow applied:', colorHex, backgroundGlow.style.background);
    } else {
        console.log('Background glow element not found');
    }
    
    // Set centerAura to a placeholder to maintain compatibility
    centerAura = { type: 'background-circle' };
}

function createCenterCubeButtons() {
    // Create both player cubes
    createSingleCenterCube('player1', 'center-cube-container-1');
    createSingleCenterCube('player2', 'center-cube-container-2');
    
    // Start animation for both cubes
    animateCenterCubes();
}

function createSingleCenterCube(player, containerId) {
    const cube = centerCubes[player];
    
    // Create separate scene for this cube
    cube.scene = new THREE.Scene();
    
    // Create camera (orthographic for perfect cube appearance)
    const frustumSize = 2;
    cube.camera = new THREE.OrthographicCamera(
        -frustumSize / 2, frustumSize / 2,  // left, right
        frustumSize / 2, -frustumSize / 2,  // top, bottom
        0.1, 100  // near, far
    );
    cube.camera.position.set(2, 2, 2);
    cube.camera.lookAt(0, 0, 0);
    
    // Create renderer
    cube.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    cube.renderer.setSize(80, 80);
    cube.renderer.setClearColor(0x000000, 0);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    cube.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    cube.scene.add(directionalLight);
    
    // Create the cube group
    cube.group = new THREE.Group();
    cube.scene.add(cube.group);
    
    // Create outer wireframe cube
    const outerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const outerEdges = new THREE.EdgesGeometry(outerGeometry);
    const outerMaterial = new THREE.LineBasicMaterial({ 
        color: 0x000000, 
        linewidth: 1,
        transparent: true,
        opacity: 1.0
    });
    cube.outer = new THREE.LineSegments(outerEdges, outerMaterial);
    cube.group.add(cube.outer);
    
    // Create inner solid cube - Player 1 starts active (red), Player 2 starts inactive (gray)
    const innerGeometry = new THREE.BoxGeometry(0.333, 0.333, 0.333);
    const innerColor = (player === 'player1') ? COLORS.RED : 0x666666;
    
    const innerMaterial = new THREE.MeshPhongMaterial({ 
        color: innerColor,
        shininess: 30,
        transparent: true,
        opacity: 1
    });
    cube.inner = new THREE.Mesh(innerGeometry, innerMaterial);
    cube.group.add(cube.inner);
    
    // Add black edges to inner cube
    const innerEdges = new THREE.EdgesGeometry(innerGeometry);
    const innerEdgeMaterial = new THREE.LineBasicMaterial({ 
        color: 0x000000, 
        linewidth: 1
    });
    const innerWireframe = new THREE.LineSegments(innerEdges, innerEdgeMaterial);
    cube.group.add(innerWireframe);
    
    // Add to HTML container
    const container = document.getElementById(containerId);
    container.appendChild(cube.renderer.domElement);
    
    // Set initial clickability - Player 1 starts clickable, Player 2 starts unclickable
    cube.renderer.domElement.addEventListener('click', onCenterCubeClick);
    if (player === 'player1') {
        cube.renderer.domElement.style.cursor = 'pointer';
        cube.renderer.domElement.style.opacity = '1';
        cube.renderer.domElement.style.pointerEvents = 'auto';
    } else {
        cube.renderer.domElement.style.cursor = 'not-allowed';
        cube.renderer.domElement.style.opacity = '0.6';
        cube.renderer.domElement.style.pointerEvents = 'none';
    }
}

function animateCenterCubes() {
    if (gameEnded) return;
    
    // Auto-rotate both cubes slowly
    const time = Date.now() * 0.001;
    
    Object.values(centerCubes).forEach(cube => {
        if (cube.group) {
            cube.group.rotation.x = time * 0.3;
            cube.group.rotation.y = time * 0.4;
            cube.group.rotation.z = time * 0.2;
        }
        
        // Render the cube
        if (cube.renderer && cube.scene && cube.camera) {
            cube.renderer.render(cube.scene, cube.camera);
        }
    });
    
    requestAnimationFrame(animateCenterCubes);
}

function updateCenterCubeButtons() {
    const centerCubeIndex = 13;
    
    if (gameBoard[centerCubeIndex] !== 0) {
        // Center cube is claimed - make both gray and disable
        Object.values(centerCubes).forEach(cube => {
            if (cube.inner) {
                cube.inner.material.color.setHex(0x666666);
            }
            if (cube.renderer && cube.renderer.domElement) {
                cube.renderer.domElement.style.cursor = 'not-allowed';
                cube.renderer.domElement.style.opacity = '0.5';
            }
        });
    } else {
        // Update colors based on current player
        updateCubeColors();
    }
}

function updateCubeColors() {
    console.log('updateCubeColors called, currentPlayer:', currentPlayer);
    
    // Player 1 cube
    if (centerCubes.player1.group) {
        const isPlayer1Active = currentPlayer === 1;
        
        console.log('Player 1 - Active:', isPlayer1Active);
        animateCubeTransition(centerCubes.player1, 'player1', isPlayer1Active);
        
        if (centerCubes.player1.renderer && centerCubes.player1.renderer.domElement) {
            if (isPlayer1Active) {
                centerCubes.player1.renderer.domElement.style.cursor = 'pointer';
                centerCubes.player1.renderer.domElement.style.opacity = '1';
                centerCubes.player1.renderer.domElement.style.pointerEvents = 'auto';
            } else {
                centerCubes.player1.renderer.domElement.style.cursor = 'not-allowed';
                centerCubes.player1.renderer.domElement.style.opacity = '0.6';
                centerCubes.player1.renderer.domElement.style.pointerEvents = 'none';
            }
        }
    }
    
    // Player 2 cube
    if (centerCubes.player2.group) {
        const isPlayer2Active = currentPlayer === 2;
        
        console.log('Player 2 - Active:', isPlayer2Active);
        animateCubeTransition(centerCubes.player2, 'player2', isPlayer2Active);
        
        if (centerCubes.player2.renderer && centerCubes.player2.renderer.domElement) {
            if (isPlayer2Active) {
                centerCubes.player2.renderer.domElement.style.cursor = 'pointer';
                centerCubes.player2.renderer.domElement.style.opacity = '1';
                centerCubes.player2.renderer.domElement.style.pointerEvents = 'auto';
            } else {
                centerCubes.player2.renderer.domElement.style.cursor = 'not-allowed';
                centerCubes.player2.renderer.domElement.style.opacity = '0.6';
                centerCubes.player2.renderer.domElement.style.pointerEvents = 'none';
            }
        }
    }
}

function animateCubeTransition(cubeObj, player, isActive) {
    const duration = 1000; // 1 second for smoother transition
    const startTime = Date.now();
    
    // Determine target colors and opacity based on active state
    const targetInnerColor = isActive ? (player === 'player1' ? COLORS.RED : COLORS.BLUE) : 0xffffff;
    const targetInnerOpacity = isActive ? 1.0 : 0.3; // translucent when inactive
    const targetBorderColor = isActive ? 0x000000 : 0x666666; // black when active, gray when inactive
    
    // Get starting values
    const startInnerColor = cubeObj.inner.material.color.clone();
    const startInnerOpacity = cubeObj.inner.material.opacity;
    const startOuterColor = cubeObj.outer.material.color.clone();
    const startInnerWireColor = cubeObj.group.children[2] ? cubeObj.group.children[2].material.color.clone() : null;
    
    // Target colors
    const endInnerColor = new THREE.Color(targetInnerColor);
    const endOuterColor = new THREE.Color(targetBorderColor);
    const endInnerWireColor = new THREE.Color(targetBorderColor);
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in-out for smooth animation
        const easeProgress = 0.5 * (1 - Math.cos(Math.PI * progress));
        
        // Animate inner cube color and opacity
        const currentInnerColor = startInnerColor.clone().lerp(endInnerColor, easeProgress);
        const currentInnerOpacity = startInnerOpacity + (targetInnerOpacity - startInnerOpacity) * easeProgress;
        
        cubeObj.inner.material.color.copy(currentInnerColor);
        cubeObj.inner.material.opacity = currentInnerOpacity;
        cubeObj.inner.material.transparent = true;
        cubeObj.inner.material.needsUpdate = true;
        
        // Animate outer wireframe color
        const currentOuterColor = startOuterColor.clone().lerp(endOuterColor, easeProgress);
        cubeObj.outer.material.color.copy(currentOuterColor);
        cubeObj.outer.material.needsUpdate = true;
        
        // Animate inner wireframe color (if exists)
        if (startInnerWireColor && cubeObj.group.children[2]) {
            const currentInnerWireColor = startInnerWireColor.clone().lerp(endInnerWireColor, easeProgress);
            cubeObj.group.children[2].material.color.copy(currentInnerWireColor);
            cubeObj.group.children[2].material.needsUpdate = true;
        }
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

function claimCube(cube) {
    const cubeIndex = cube.userData.index;
    const playerColor = currentPlayer === 1 ? COLORS.RED : COLORS.BLUE;
    
    // Mark as claimed
    cube.userData.claimed = true;
    gameBoard[cubeIndex] = currentPlayer;
    
    // Change all stickers to player color
    cube.userData.stickers.forEach(sticker => {
        sticker.material.color.setHex(playerColor);
    });
    
    // Fade out instructions after first move
    if (!firstMoveMade) {
        firstMoveMade = true;
        const instructions = document.getElementById('instructions');
        instructions.classList.add('fade-out');
        setTimeout(() => {
            instructions.style.display = 'none';
        }, 800);
    }
    
    // Check for win
    if (checkWin()) {
        endGame(currentPlayer);
        return;
    }
    
    // Check for draw
    if (gameBoard.every(cell => cell !== 0)) {
        endGame(0); // Draw
        return;
    }
    
    // Switch players
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateUI();
    updateCenterCubeButtons();
}

function checkWin() {
    // 3D Tic-tac-toe win conditions
    // Index mapping: index = x * 9 + y * 3 + z
    // So for position (x,y,z): index = x*9 + y*3 + z
    const winPatterns = [
        // Horizontal lines (X direction) - 9 patterns
        [0,1,2], [3,4,5], [6,7,8], // Layer z=0, y=0,1,2
        [9,10,11], [12,13,14], [15,16,17], // Layer z=1, y=0,1,2
        [18,19,20], [21,22,23], [24,25,26], // Layer z=2, y=0,1,2
        
        // Vertical lines (Y direction) - 9 patterns
        [0,3,6], [1,4,7], [2,5,8], // Layer z=0, x=0,1,2
        [9,12,15], [10,13,16], [11,14,17], // Layer z=1, x=0,1,2
        [18,21,24], [19,22,25], [20,23,26], // Layer z=2, x=0,1,2
        
        // Depth lines (Z direction) - 9 patterns
        [0,9,18], [1,10,19], [2,11,20], // y=0, x=0,1,2
        [3,12,21], [4,13,22], [5,14,23], // y=1, x=0,1,2
        [6,15,24], [7,16,25], [8,17,26], // y=2, x=0,1,2
        
        // Face diagonals on XY planes (6 patterns)
        [0,4,8], [2,4,6], // z=0 layer diagonals
        [9,13,17], [11,13,15], // z=1 layer diagonals
        [18,22,26], [20,22,24], // z=2 layer diagonals
        
        // Face diagonals on XZ planes (6 patterns)
        [0,12,24], [6,12,18], // y=0 plane diagonals
        [1,13,25], [7,13,19], // y=1 plane diagonals
        [2,14,26], [8,14,20], // y=2 plane diagonals
        
        // Face diagonals on YZ planes (6 patterns)
        [0,10,20], [6,16,26], // x=0 plane diagonals
        [3,13,23], [5,13,21], // x=1 plane diagonals
        [2,12,22], [8,16,24], // x=2 plane diagonals (fixed)
        
        // 3D space diagonals (4 patterns - the main cube diagonals)
        [0,13,26], [2,13,24], [6,13,20], [8,13,18]
    ];
    
    for (const pattern of winPatterns) {
        if (pattern.every(index => gameBoard[index] === currentPlayer)) {
            return true;
        }
    }
    
    return false;
}

function endGame(winner) {
    gameEnded = true;
    
    const winMessage = document.getElementById('win-message');
    
    if (winner === 0) {
        winMessage.textContent = "DRAW";
        winMessage.style.color = '#000000';
    } else if (winner === 1) {
        winMessage.textContent = "PLAYER 1 WINS!";
        winMessage.style.color = '#FF0000';
    } else {
        winMessage.textContent = "PLAYER 2 WINS!";
        winMessage.style.color = '#0000FF';
    }
    
    setTimeout(() => {
        winMessage.classList.add('show');
    }, 500);
}

function updateUI() {
    const player1UI = document.getElementById('player1');
    const player2UI = document.getElementById('player2');
    
    if (currentPlayer === 1) {
        player1UI.classList.add('player-active');
        player2UI.classList.remove('player-active');
    } else {
        player2UI.classList.add('player-active');
        player1UI.classList.remove('player-active');
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    if (controls) {
        controls.update();
    }
    
    // No animation needed for background circle
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize the game when the page loads
window.addEventListener('load', init);
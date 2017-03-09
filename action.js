const size = 30;
const stroke = 2;
const color = {
  top: 0xEEEEEE,
  right: 0x999999,
  left: 0xCCCCCC,
  front: 0xDDDDDD,
  back: 0xAAAAAA,
  bottom: 0x777777,

  stroke: 0x00000,
};

const STROKE_OPACITY = 0.2;
const FILL_OPACITY = 0.8;

const shift = {
  x: -5,
  y: -2,
  z: 0,
};

const blocks = [
  // L
  {
    x: 0,
    y: 0,
    z: 0,
  }, {
    x: 1,
    y: 0,
    z: 0,
  }, {
    x: 2,
    y: 0,
    z: 1,
  }, {
    x: 0,
    y: 0,
    z: -1,
  }, {
    x: 0,
    y: 1,
    z: -1,
  }, {
    x: 0,
    y: 2,
    z: -1,
  }, {
    x: 0,
    y: 3,
    z: -1,
  },

  // A
  {
    x: 4,
    y: 0,
    z: 0,
  }, {
    x: 4,
    y: 1,
    z: 0,
  }, {
    x: 4,
    y: 2,
    z: 0,
  }, {
    x: 4,
    y: 3,
    z: 0,
  }, {
    x: 5,
    y: 3,
    z: 0,
  }, {
    x: 6,
    y: 0,
    z: 0,
  }, {
    x: 6,
    y: 1,
    z: 0,
  }, {
    x: 6,
    y: 2,
    z: 0,
  }, {
    x: 6,
    y: 3,
    z: 0,
  }, {
    x: 5,
    y: 1,
    z: -1,
  },

  // B
  {
    x: 8,
    y: 0,
    z: 0,
  }, {
    x: 8,
    y: 1,
    z: 0,
  }, {
    x: 8,
    y: 2,
    z: 0,
  }, {
    x: 8,
    y: 3,
    z: 0,
  }, {
    x: 9,
    y: 3,
    z: 0,
  }, {
    x: 10,
    y: 0,
    z: 0,
  }, {
    x: 10,
    y: 1,
    z: 0,
  }, {
    x: 10,
    y: 3,
    z: 0,
  }, {
    x: 9,
    y: 2,
    z: -1,
  }, {
    x: 9,
    y: 0,
    z: 0,
  },
];

const ROTATION_STALL_RATIO = 5000;
const CAMERA_DISTANCE = 200;
const INITIAL_ROTATION = new THREE.Vector3(-0.2 , 0.2, 0).multiplyScalar(ROTATION_STALL_RATIO);
const FORCE_RATIO = 10;
const DAMPING = 2 * Math.sqrt(FORCE_RATIO);

const targetRotation = new THREE.Vector3(0, 0, ROTATION_STALL_RATIO).add(INITIAL_ROTATION).normalize();
const rotationSpeed = new THREE.Vector3(0, 0, 0);

function setupMouseListener() {
  document.onmousemove = event => {
    targetRotation.set(
      (event.x - document.body.offsetWidth / 2),
      - (event.y - document.body.offsetHeight / 2),
      ROTATION_STALL_RATIO,
    )
    .add(INITIAL_ROTATION)
    .normalize();
  }
}

function bootstrap() {
  const canvas = document.getElementById('container');

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    - canvas.width / 2,
    canvas.width / 2,
    canvas.height / 2,
    - canvas.height / 2,
    1, 1000);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setClearColor(0xFFFFFF, 0);

  let pendingSizeUpdate = true;
  const updateSize = () => {
    pendingSizeUpdate = false;
    canvas.width = document.body.offsetWidth;
    canvas.height = document.body.offsetHeight;

    camera.left = -canvas.width / 2;
    camera.right = canvas.width / 2;
    camera.top = canvas.height / 2;
    camera.bottom = -canvas.height / 2;
    camera.updateProjectionMatrix();

    renderer.setSize(canvas.width, canvas.height);
  };

  document.body.onresize = () => pendingSizeUpdate = true;

  updateSize();

  const materials = [
    'right', 'left', 'top', 'bottom', 'front', 'back',
  ].map(id => new THREE.MeshBasicMaterial({
    color: color[id],
    opacity: FILL_OPACITY,
    transparent: true,
  }));
  const fillMat = new THREE.MultiMaterial(materials);
  fillMat.opacity = FILL_OPACITY;
  fillMat.transparent = true;
  const strokeMat = new THREE.LineBasicMaterial({
    color: color.stroke,
    linewidth: stroke,
    opacity: STROKE_OPACITY,
    transparent: true,
  });

  for(block of blocks) {
    const cubeGeo = new THREE.BoxGeometry(size, size, size);
    const cube = new THREE.Mesh(cubeGeo, fillMat);

    const edgesGeo = new THREE.EdgesGeometry(cubeGeo);
    const edges = new THREE.LineSegments(edgesGeo, strokeMat);

    cube.position.x = (block.x + shift.x) * size;
    cube.position.y = (block.y + shift.y) * size;
    cube.position.z = (block.z + shift.z) * size;

    edges.position.copy(cube.position);
    
    scene.add(cube);
    scene.add(edges);
  }

  camera.position.copy(targetRotation);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  setupMouseListener();

  let prevTs = window.performance.now();

  function render(nowTs) {
    requestAnimationFrame(render);

    if(pendingSizeUpdate) updateSize();

    camera.position.applyAxisAngle(rotationSpeed, rotationSpeed.length());
    camera.position.setLength(CAMERA_DISTANCE);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    renderer.render(scene, camera);

    const force = camera.position.clone().cross(targetRotation).setLength(
      camera.position.angleTo(targetRotation) * FORCE_RATIO
    ).add(rotationSpeed.clone().multiplyScalar(DAMPING).negate());

    rotationSpeed.add(
      force.multiplyScalar((nowTs - prevTs) / 1000)
    );

    prevTs = nowTs;
  }

  requestAnimationFrame(render);
}

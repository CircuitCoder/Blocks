const SIZE = 30;
const STROKE = 2;
const COLOR = {
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

const SHIFT = new THREE.Vector3(-5, -2, 0);

const BLOCKS = [
  // L
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(2, 0, 1),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 1, -1),
  new THREE.Vector3(0, 2, -1),
  new THREE.Vector3(0, 3, -1),

  // A

  new THREE.Vector3(4, 0, 0),
  new THREE.Vector3(4, 1, 0),
  new THREE.Vector3(4, 2, 0),
  new THREE.Vector3(4, 3, 0),
  new THREE.Vector3(5, 3, 0),
  new THREE.Vector3(6, 0, 0),
  new THREE.Vector3(6, 1, 0),
  new THREE.Vector3(6, 2, 0),
  new THREE.Vector3(6, 3, 0),
  new THREE.Vector3(5, 1, -1),

  // B
  new THREE.Vector3(8, 0, 0),
  new THREE.Vector3(8, 1, 0),
  new THREE.Vector3(8, 2, 0),
  new THREE.Vector3(8, 3, 0),
  new THREE.Vector3(9, 3, 0),
  new THREE.Vector3(10, 0, 0),
  new THREE.Vector3(10, 1, 0),
  new THREE.Vector3(10, 3, 0),
  new THREE.Vector3(9, 2, -1),
  new THREE.Vector3(9, 0, 0),
];

const ROTATION_STALL_RATIO = 2000;
const CAMERA_DISTANCE = 200;
const INITIAL_ROTATION = new THREE.Vector3(-0.4, -0.4, 0);
const FORCE_RATIO = 50;
const DAMPING = 2 * Math.sqrt(FORCE_RATIO);

const targetAxis = new THREE.Vector3(0, 0, 0);
const currentRotation = new THREE.Vector3(0, 0, 0);
const rotationSpeed = new THREE.Vector3(0, 0, 0);

const ENTER_FROM = new THREE.Vector3(0, 10, 0);
const ANIMATION_LENGTH = 200; // ms
const DELAY_FACTOR = new THREE.Vector3(1, 1, 1).setLength(5); // ms
const ANIMATION_BEZIER = bezier(.17, .67, .83, .67);

const ZERO_EPS = 1e-8;

function setupMouseListener() {
  document.onmousemove = event => {
    targetAxis.set(
      (event.x - document.body.offsetWidth / 2),
      - (event.y - document.body.offsetHeight / 2),
      ROTATION_STALL_RATIO,
    )
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
    color: COLOR[id],
    opacity: 0,
    transparent: true,
  }));
  const fillMat = new THREE.MultiMaterial(materials);
  const strokeMat = new THREE.LineBasicMaterial({
    color: COLOR.stroke,
    linewidth: STROKE,
    opacity: 0,
    transparent: true,
  });

  const cubes = new Set();

  for(block of BLOCKS) {
    const localFillMat = fillMat.clone();
    const localStrokeMat = strokeMat.clone();

    const cubeGeo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const cube = new THREE.Mesh(cubeGeo, localFillMat);

    const edgesGeo = new THREE.EdgesGeometry(cubeGeo);
    const edges = new THREE.LineSegments(edgesGeo, localStrokeMat);

    cube.position.copy(block).add(SHIFT).multiplyScalar(SIZE);
    edges.position.copy(cube.position);

    cube.position.add(ENTER_FROM);
    
    scene.add(cube);
    scene.add(edges);

    cubes.add({
      edges, cube, block, mat: {
        fill: localFillMat,
        stroke: localStrokeMat,
      }
    });
  }

  camera.position.copy(targetAxis);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  setupMouseListener();

  let prevTs = window.performance.now();
  const firstTs = prevTs;

  function render(nowTs) {
    requestAnimationFrame(render);

    if(pendingSizeUpdate) updateSize();

    camera.position.set(0, 0, CAMERA_DISTANCE);

    const rotation = currentRotation.clone().add(INITIAL_ROTATION);

    if(rotation.length() > ZERO_EPS)
      camera.position.applyAxisAngle(rotation, rotation.length());

    camera.lookAt(new THREE.Vector3(0, 0, 0));

    renderer.render(scene, camera);

    const targetRotation = new THREE.Vector3(0, 0, 1).cross(targetAxis).setLength(
      new THREE.Vector3(0, 0, 1).angleTo(targetAxis)
    );

    const force = currentRotation.clone().sub(targetRotation)
      .multiplyScalar(FORCE_RATIO)
      .negate()
      .add(rotationSpeed.clone().multiplyScalar(DAMPING).negate());

    rotationSpeed.add(
      force.multiplyScalar((nowTs - prevTs) / 1000)
    );

    currentRotation.add(rotationSpeed.clone().multiplyScalar((nowTs - prevTs) / 1000));

    // Apply animation
    for(cube of cubes) {
      const delay = cube.block.clone().multiplyScalar(SIZE).dot(DELAY_FACTOR);
      let progress = (nowTs - firstTs - delay) / ANIMATION_LENGTH;

      if(progress < 0) continue;
      if(progress > 1) progress = 1;

      const ratio = progress;

      cube.cube.position.copy(cube.block)
        .add(SHIFT)
        .multiplyScalar(SIZE)
        .add(ENTER_FROM.clone().multiplyScalar(1 - ratio));

      cube.mat.stroke.opacity = ratio * STROKE_OPACITY;
      for(fm of cube.mat.fill.materials) fm.opacity = ratio * FILL_OPACITY;

      if(progress >= 1) {
        cubes.delete(cube);
        continue;
      }
    }

    prevTs = nowTs;
  }

  requestAnimationFrame(render);
}

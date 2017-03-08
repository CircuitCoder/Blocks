const size = 40;
const color = {
  top: 0xEEEEEE,
  right: 0x999999,
  left: 0xCCCCCC,
  front: 0xDDDDDD,
  back: 0x00AAAA,
  bottom: 0x777777,
};

const blocks = [
  {
    x: 0,
    y: 0,
    z: 0,
  }, {
    x: 1,
    y: 0,
    z: 2,
  }
];

const ROTATION_STALL_RATIO = 10000;
const CAMERA_DISTANCE = 200;
const INITIAL_ROTATION = new THREE.Vector3(-0.2 , 0.2, 0).multiplyScalar(ROTATION_STALL_RATIO);
const FORCE_RATIO = 0.5;
const DAMPING = 2.5;

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
  ].map(id => new THREE.MeshBasicMaterial({ color: color[id] }));

  for(block of blocks) {
    const cubeGeo = new THREE.BoxGeometry(size, size, size);
    const cubeMat = new THREE.MultiMaterial(materials);
    const cube = new THREE.Mesh(cubeGeo, cubeMat);

    cube.position.x = block.x * size;
    cube.position.y = block.y * size;
    cube.position.z = block.z * size;

    scene.add(cube);
  }

  camera.position.z = CAMERA_DISTANCE; 

  setupMouseListener();

  function render() {
    requestAnimationFrame(render);

    if(pendingSizeUpdate) updateSize();

    camera.position.applyAxisAngle(rotationSpeed, rotationSpeed.length());
    camera.position.setLength(CAMERA_DISTANCE);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    renderer.render(scene, camera);

    rotationSpeed.add(
      camera.position.clone().cross(targetRotation).setLength(
        camera.position.angleTo(targetRotation) * FORCE_RATIO
      )
    );

    rotationSpeed.multiplyScalar(1 - rotationSpeed.length() * DAMPING);
  }

  render();
}

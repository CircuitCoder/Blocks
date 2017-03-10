const SIZE = 30;
const STROKE = 2;
const COLOR = {
  top: 0xEEEEEE,
  right: 0x999999,
  left: 0xCCCCCC,
  front: 0xDDDDDD,
  back: 0xAAAAAA,
  bottom: 0x777777,

  stroke: 0x000000,
  stroke_edit: 0xffffff,
};

const STROKE_OPACITY = 0.2;
const FILL_OPACITY = 0.8;

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
const ANIMATION_EASE_OUT = bezier(0, 0, .58, 1);
const ANIMATION_EASE_IN = bezier(.42, 0, 1, 1);
const ANIMATION_EASE = bezier(.17, .67, .83, .67);

const ZERO_EPS = 1e-8;

let skipFrame = false;

let editMode = false;
let modeSwitch = false;
let modeSwitchTs = -1;
let modeSwitchFrom;

const editFacing = new THREE.Vector3(0, 0, 1);

function setupListeners(removeAll) {
  document.onmousemove = event => {
    targetAxis.set(
      (event.x - document.body.offsetWidth / 2),
      - (event.y - document.body.offsetHeight / 2),
      ROTATION_STALL_RATIO,
    )
    .normalize();
  }

  window.onblur = event => {
    skipFrame = true;
  }

  window.onkeydown = event => {
    if(event.code === 'KeyE') {
      modeSwitch = true;
      editMode = !editMode;

      if(editMode) document.getElementById('background').classList.remove('hidden');
      else document.getElementById('background').classList.add('hidden');

      modeSwitchTs = -1;

      editFacing.set(0, 0, 1);
    } else if(event.code === 'KeyD') {
      editFacing.applyEuler(new THREE.Euler(0, - Math.PI / 2, 0));
    } else if(event.code === 'KeyA') {
      editFacing.applyEuler(new THREE.Euler(0, Math.PI / 2, 0));
    } else if(event.code === 'KeyS') {
      editFacing.applyEuler(new THREE.Euler(- Math.PI / 2, 0, 0));
    } else if(event.code === 'KeyW') {
      editFacing.applyEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    } else if(event.code === 'KeyZ') {
      removeAll();
    }
  }
}

function colorBetween(from, to, ratio) {
  const blue = (from % 0x100) * (1 - ratio) + (to % 0x100) * ratio;
  const green = (Math.floor(from / 0x100) % 0x100) * (1 - ratio) + (Math.floor(to / 0x100) % 0x100) * ratio;
  const red = (Math.floor(from / 0x10000) % 0x100) * (1 - ratio) + (Math.floor(to / 0x10000) % 0x100) * ratio;

  return Math.floor(red) * 0x10000 + Math.floor(green) * 0x100 + Math.floor(blue);
}

function bootstrap() {
  const canvas = document.getElementById('container');

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    - canvas.width / 2,
    canvas.width / 2,
    canvas.height / 2,
    - canvas.height / 2,
    1, 100000);

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

  const cubes = [];

  function addBlock(vec, visible = false) {
    const localFillMat = fillMat.clone();
    const localStrokeMat = strokeMat.clone();

    const cubeGeo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const cube = new THREE.Mesh(cubeGeo, localFillMat);

    const edgesGeo = new THREE.EdgesGeometry(cubeGeo);
    const edges = new THREE.LineSegments(edgesGeo, localStrokeMat);

    cube.position.copy(vec).multiplyScalar(SIZE);
    edges.position.copy(cube.position);

    if(!visible) cube.position.add(ENTER_FROM);
    else {
      for(let mat of localFillMat.materials) mat.opacity = 0.05 * FILL_OPACITY;
      localStrokeMat.opacity = STROKE_OPACITY;
      localStrokeMat.color.setHex(COLOR.stroke_edit);
    }
    
    scene.add(cube);
    scene.add(edges);

    cubes.push({
      edges, cube, block: vec.clone(), mat: {
        fill: localFillMat,
        stroke: localStrokeMat,
      }
    });
  }

  for(block of BLOCKS)
    addBlock(block);

  const enteringCubes = new Set(cubes);

  camera.position.copy(targetAxis);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  let prevTs = window.performance.now();
  const firstTs = prevTs;

  function render(nowTs) {
    requestAnimationFrame(render);

    if(pendingSizeUpdate) updateSize();

    camera.position.set(0, 0, CAMERA_DISTANCE);

    const rotation = currentRotation.clone().add(INITIAL_ROTATION);

    if(rotation.length() > ZERO_EPS)
      camera.position.applyAxisAngle(rotation.clone().normalize(), rotation.length());

    camera.lookAt(new THREE.Vector3(0, 0, 0));

    renderer.render(scene, camera);

    if(skipFrame)
      skipFrame = false;
    else {
      const appliedTargetAxis = editMode ? editFacing : targetAxis;

      const targetRotation = new THREE.Vector3(0, 0, 1).cross(appliedTargetAxis).setLength(
        new THREE.Vector3(0, 0, 1).angleTo(appliedTargetAxis)
      );

      const force = currentRotation.clone().sub(targetRotation)
        .multiplyScalar(FORCE_RATIO)
        .negate()
        .add(rotationSpeed.clone().multiplyScalar(DAMPING).negate());

      rotationSpeed.add(
        force.multiplyScalar((nowTs - prevTs) / 1000)
      );

      currentRotation.add(rotationSpeed.clone().multiplyScalar((nowTs - prevTs) / 1000));
    }

    // Apply animation
    for(cube of enteringCubes) {
      const delay = cube.block.clone().multiplyScalar(SIZE).dot(DELAY_FACTOR);
      let progress = (nowTs - firstTs - delay) / ANIMATION_LENGTH;

      if(progress < 0) continue;
      if(progress > 1) progress = 1;

      const ratio = ANIMATION_EASE_OUT(progress);

      cube.cube.position.copy(cube.block)
        .multiplyScalar(SIZE)
        .add(ENTER_FROM.clone().multiplyScalar(1 - ratio));

      cube.mat.stroke.opacity = ratio * STROKE_OPACITY;
      for(fm of cube.mat.fill.materials) fm.opacity = ratio * FILL_OPACITY;

      if(progress >= 1) {
        enteringCubes.delete(cube);
        continue;
      }
    }


    if(modeSwitch) {
      if(modeSwitchTs < 0) {
        modeSwitchTs = nowTs;
        modeSwitchFrom = {
          stroke: cubes[0].mat.stroke.color.getHex(),
          fill: cubes[0].mat.fill.materials[0].opacity / FILL_OPACITY,
        };
      }

      if(nowTs > modeSwitchTs + ANIMATION_LENGTH) modeSwitchTs = nowTs - ANIMATION_LENGTH;

      const progress = (nowTs - modeSwitchTs) / ANIMATION_LENGTH;
      const from = modeSwitchFrom.stroke;
      const to = editMode ? COLOR.stroke_edit : COLOR.stroke;
      const nowColor = colorBetween(from, to, ANIMATION_EASE(progress));

      for(cube of cubes) {
        cube.mat.stroke.color.setHex(nowColor);
        const fillRatio = editMode ? ANIMATION_EASE_IN(progress) : ANIMATION_EASE_OUT(progress);
        const fillTarget = editMode ? 0.05 : 1;
        const fillContent = FILL_OPACITY * (fillRatio * fillTarget + (1 - fillRatio) * modeSwitchFrom.fill);

        for(mat of cube.mat.fill.materials)
          mat.opacity = fillContent;
      }

      if(nowTs === modeSwitchTs + ANIMATION_LENGTH) {
        modeSwitch = false;
        modeSwitchTs = -1;
      }
    }

    prevTs = nowTs;
  }

  requestAnimationFrame(render);

  // Remove
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function removeCube(i) {
    scene.remove(cubes[i].cube);
    scene.remove(cubes[i].edges);
    
    cubes.splice(i, 1);

    if(cubes.length === 0) {
      addBlock(new THREE.Vector3(0, 0, 0), true);

      console.log(cubes[0].cube.position);
      return false;
    }

    return true;
  }

  window.onmousedown = event => {
    if(!editMode) return true;

    mouse.x = (event.x / document.body.offsetWidth) * 2 - 1;
    mouse.y = - (event.y / document.body.offsetHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children);

    if(intersects.length > 0)
      if(event.button == 0) {
        const target = intersects[0].object;
        for(let i = 0; i < cubes.length; ++i)
          if(cubes[i].cube === target || cubes[i].stroke === target) {
            removeCube(i);
            break;
          }
      } else {
        for(const intersect of intersects)
          if('face' in intersect) {
            for(let i = 0; i < cubes.length; ++i)
              if(cubes[i].cube === intersect.object) {
                addBlock(cubes[i].block.clone().add(intersect.face.normal), true);
                break;
              }
            break;
          }
      }
    return false;
  }

  window.oncontextmenu = event => {
    if(editMode) return false;
  }

  setupListeners(() => {
    if(!editMode) return;
    while(removeCube(0)) ;
  });
}

import { EditorUIController } from "../../engine/UserInterface/EditorUIController";
import { WebGLRenderEngine } from "../../engine/RenderingPipeline/Webgl/WebGLRenderEngine";
import { CameraController } from "../../engine/CameraSystem/CameraController";
import { SceneHierarchyManager } from "../../engine/SceneGraph/SceneHierarchyManager";
import { PBRMaterialProperties } from "../../engine/MaterialSystem/PBRMaterialProperties";
import { TextureAssetLoader } from "../../engine/CoreUtilities/TextureAssetLoader";
import { GridHelper } from "../../engine/CoreUtilities/GridHelper";
import { RenderableMeshObject } from "../../engine/MeshRenderer/RenderableMeshObject";
import { BoxGeometryBuilder } from "../../engine/GeometryPrimitives/BoxGeometryBuilder";
import { SphereGeometryBuilder } from "../../engine/GeometryPrimitives/SphereGeometryBuilder";
import { PlaneGeometryBuilder } from "../../engine/GeometryPrimitives/PlaneGeometryBuilder";
import { ConeGeometryBuilder } from "../../engine/GeometryPrimitives/ConeGeometryBuilder";
import { CylinderGeometryBuilder } from "../../engine/GeometryPrimitives/CylinderGeometryBuilder";
import { SceneLightingManager } from "../../engine/LightingEngine/SceneLightingManager";
import { GLTFAssetLoader } from "../../engine/AssetImporter/GLTFAssetLoader";
import { SceneInteractionHandler } from "../../engine/EventManager/SceneInteractionHandler";
import { GLTFSceneExporter } from "../../engine/AssetImporter/GLTFSceneExporter";
import { createProgram } from "../../engine/RenderingPipeline/Webgl/ShaderProgramLinker";
import { PointLightNode } from "../../engine/LightingEngine/PointLightNode";
import { SpotLightNode } from "../../engine/LightingEngine/SpotLightNode";
import { DirectionalLightNode } from "../../engine/LightingEngine/DirectionalLightNode";
import { SceneNode } from "../../engine/SceneGraph/SceneNode";
import { LightNode } from "../../engine/LightingEngine/LightNode";
import {
  PointLightvsSource, PointLightfsSource,
  SpotLightvsSource, SpotLightfsSource,
  DirLightvsSource, DirLightfsSource
} from "../../engine/RenderingPipeline/Shaders/GLSLShaderLibrary";


// Initialize canvas and WebGL
const canvas = document.getElementById("Mycanvas") as HTMLCanvasElement;
const webgl = new WebGLRenderEngine(canvas);

// Resize canvas to fit viewport
// Initialize camera  
const camera = new CameraController();

// Consolidated resize and aspect update
function handleResize() {
  const viewport = document.getElementById("viewport-container");
  if (viewport) {
    const rect = viewport.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    // Update renderer resolution and viewport
    webgl.resize(width, height);

    // Update camera aspect ratio
    const aspect = width / height;
    if (camera) {
      if ((camera as any).projectionType === "orthographic") {
        const size = 2.0;
        camera.OrthographicCamera(-size * aspect, size * aspect, -size, size, 0.1, 1000);
      } else {
        camera.PerspectiveCamera(45, aspect, 0.1, 1000);
      }
      camera.OrbitCamera();
    }
  }
}

// Initial setup
handleResize();

// Consolidated resize listener
window.addEventListener("resize", handleResize);

// Initialize scene
const scene = new SceneHierarchyManager();
const gl = webgl.gl;

// Initialize material and texture loader
const material = new PBRMaterialProperties();
const MaterialColor = material.BaseColors();
const Texture = new TextureAssetLoader(gl, scene);

// Add a grid for reference
let currentGridSettings = { size: 20, spacing: 3.0, visible: true };
let gridGenerator = new GridHelper(currentGridSettings.size, currentGridSettings.spacing);
let gridMesh = new RenderableMeshObject(gridGenerator.createGrid());
gridMesh.position = { x: 0, y: 0, z: 0 };
gridMesh.updateTranslate();
scene.add(gridMesh);

const boxGeometry = new BoxGeometryBuilder();
const cubeMaterial = material.getMaterialProperties({
  color: MaterialColor.red,
  metallic: 0.5,
  roughness: 0.5,
  specular: 16.0,
  alpha: 1.0,
  emissionColor: [0.0, 0.0, 0.0],
  emissionIntensity: 0.0,
});
const cube = new RenderableMeshObject(boxGeometry.CubeData(), cubeMaterial);
cube.position = { x: 0, y: 0, z: 0 };
cube.updateTranslate();
scene.add(cube);
// Handle Grid changes (moved below uiManager initialization)

// Initialize light system
let program: any = null;
// Set up light shader programs
const pointProgram = createProgram(gl, PointLightvsSource as string, PointLightfsSource as string);
const spotProgram = createProgram(gl, SpotLightvsSource as string, SpotLightfsSource as string);
const dirProgram = createProgram(gl, DirLightvsSource as string, DirLightfsSource as string);

// Create a master light instance that will hold all lights
const masterLight = new SceneLightingManager(gl, pointProgram);
masterLight.lightType = "point";

// Current active program starts with point light
program = pointProgram;
gl.useProgram(program);

// Set base light properties
masterLight.BaseLight({
  ambientLight: [0.2, 0.2, 0.2],
  diffuseLight: [1.0, 1.0, 1.0],
  specularLight: [1.0, 1.0, 1.0],
});
scene.globalLight = masterLight;

// Add default point light
const defaultLight = new PointLightNode("Main Point Light");
defaultLight.position = { x: 0, y: 0, z: 3 };
defaultLight.radius = 2.0;
defaultLight.color = [1, 1, 1];
defaultLight.intensity = 2.0;
scene.add(defaultLight);

// Store individual light instances for UI tracking
const lightInstances: Map<string, { light: SceneLightingManager; type: string; index: number }> = new Map();
// Add the default light to tracking
lightInstances.set(masterLight.uuid, { light: masterLight, type: "point", index: 0 });

// Initialize GLTF loader
const loader = new GLTFAssetLoader(gl, scene);

// Initialize events
const events = new SceneInteractionHandler(scene, camera, canvas, gl);

// Synchronize viewport selection with UI
events.onSelect = (uuid) => {
  if (uuid) {
    uiManager.selectObject(uuid);
  }
};

// Track previous selection to detect changes
let previousSelectedUUID: string | null = null;

// Initialize UI Manager
const uiManager = new EditorUIController();

// Handle Grid changes
uiManager.onGridChange((settings) => {
  if (settings.size !== currentGridSettings.size || settings.spacing !== currentGridSettings.spacing) {
    // Regenerate grid geometry
    gridGenerator.size = settings.size;
    gridGenerator.spacing = settings.spacing;
    const newData = gridGenerator.createGrid();

    // Update mesh geometry
    gridMesh.vertices = newData.Vertices as Float32Array;
    gridMesh.geometryNeedsUpdate = true;
  }

  gridMesh.visible = settings.visible;
  currentGridSettings = { ...settings };
});



// Store references to created objects
const createdObjects: Map<string, any> = new Map();
let selectedObject: any = null;

// Scene graph update counter
let frameCount = 0;

// Update scene graph
function updateSceneGraph() {
  const sceneObjects: any[] = [];

  const convertNode = (node: SceneNode): any => {
    return {
      uuid: node.uuid,
      name: node.name || node.type || "Object",
      type: node.type,
      isGizmoPart: (node as any).isGizmoPart || false,
      children: node.children
        .filter(child => {
          const isGizmo = (child as any).isGizmoPart || child.type?.startsWith("Gizmo-");
          return !isGizmo;
        })
        .map(child => convertNode(child))
    };
  };

  // Get root nodes from scene manager
  const roots = scene.getRootNodes();
  roots.forEach(root => {
    const isGizmo = (root as any).isGizmoPart || root.type?.startsWith("Gizmo-");
    if (root.type !== "Grid-Geometry" && !isGizmo) {
      sceneObjects.push(convertNode(root));
    }
  });

  // Add camera
  sceneObjects.push({
    uuid: camera.uuid,
    name: "Camera",
    type: "Camera",
  });

  uiManager.updateSceneGraph(sceneObjects);
}

// Handle reparenting
uiManager.onNodeReparent((childUuid, parentUuid) => {
  const findNode = (nodes: SceneNode[], uuid: string): SceneNode | null => {
    for (const node of nodes) {
      if (node.uuid === uuid) return node;
      const found = findNode(node.children, uuid);
      if (found) return found;
    }
    return null;
  };

  const allNodes = scene.nodes;
  const childNode = findNode(allNodes, childUuid);
  const parentNode = parentUuid ? findNode(allNodes, parentUuid) : null;

  if (childNode) {
    childNode.setParent(parentNode);
    updateSceneGraph();
    console.log(`Reparented ${childNode.name} to ${parentNode ? parentNode.name : 'Root'}`);
  }
});

// Handle object selection
uiManager.onObjectSelect((uuid: string) => {
  // Find object in scene
  let foundObject: any = null;

  // Check meshes
  for (const mesh of scene.objects) {
    if (mesh.uuid === uuid) {
      foundObject = mesh;
      break;
    }
    // Check children
    if (mesh.children) {
      for (const child of mesh.children) {
        if (child.uuid === uuid) {
          foundObject = child;
          break;
        }
      }
    }
  }

  // Check lights - handle LightNode instances
  if (!foundObject) {
    for (const light of scene.lights) {
      if (light.uuid === uuid) {
        foundObject = light;
        break;
      }
    }
  }

  // Check camera
  if (!foundObject && camera.uuid === uuid) {
    foundObject = camera;
  }

  if (foundObject) {
    selectedObject = foundObject;
    previousSelectedUUID = uuid; // Use the passed UUID directly
    updateObjectProperties(foundObject);

    // Dynamic Shader Switching based on selected object
    if (foundObject.type === "PointLight") {
      program = pointProgram;
    } else if (foundObject.type === "SpotLight") {
      program = spotProgram;
    } else if (foundObject.type === "DirectionalLight") {
      program = dirProgram;
    } else {
      // For meshes or other objects, default to point light or some standard shader
      // Since the user is using specialized shaders, we'll keep the last light shader or point light
      if (!program) program = pointProgram;
    }
    gl.useProgram(program);

    // If it's a mesh, select it in the scene
    if (foundObject instanceof RenderableMeshObject) {
      events.selectedObject = foundObject;
      events.isObjectSelected = true;
      events.select = [foundObject];

      // Update WebGL selected object
      if (events.webgl) {
        events.webgl.selectedObject = foundObject;
      }
      console.log(foundObject);

      if (events.gizmo) {
        events.gizmo.visible = true;
        events.updateGizmoPosition(foundObject);
        if (!events.gizmo.gizmoMeshes.length) {
          events.gizmo.addToScene(scene);
        }
      }
    } else {
      // Light or Camera selected from UI - clear viewport selection to avoid confusion
      events.selectedObject = null;
      events.isObjectSelected = false;
      events.select = [];
      if (events.gizmo) {
        events.gizmo.visible = false;
        events.gizmo.removeFromScene(scene);
      }
    }
  }
});

// Update object properties in UI
function updateObjectProperties(obj: any) {
  const objectType = obj.type || "Unknown";
  const objectUUID = obj.uuid || "-";

  // Update type and UUID
  const typeElement = document.getElementById("object-type");
  const uuidElement = document.getElementById("object-uuid");
  if (typeElement) typeElement.textContent = objectType;
  if (uuidElement) uuidElement.textContent = objectUUID;

  // Update transform properties
  const pos = obj.position || (obj === camera ? camera.eye : null);
  if (pos) {
    (document.getElementById("pos-x") as HTMLInputElement).value = (pos.x as number)?.toFixed(2) || "0.00";
    (document.getElementById("pos-y") as HTMLInputElement).value = (pos.y as number)?.toFixed(2) || "0.00";
    (document.getElementById("pos-z") as HTMLInputElement).value = (pos.z as number)?.toFixed(2) || "0.00";
  }

  if (obj.rotate) {
    (document.getElementById("rot-x") as HTMLInputElement).value = obj.rotate.x?.toFixed(2) || "0.00";
    (document.getElementById("rot-y") as HTMLInputElement).value = obj.rotate.y?.toFixed(2) || "0.00";
    (document.getElementById("rot-z") as HTMLInputElement).value = obj.rotate.z?.toFixed(2) || "0.00";
  }

  if (obj.scale) {
    (document.getElementById("scale-x") as HTMLInputElement).value = obj.scale.x?.toFixed(2) || "1.00";
    (document.getElementById("scale-y") as HTMLInputElement).value = obj.scale.y?.toFixed(2) || "1.00";
    (document.getElementById("scale-z") as HTMLInputElement).value = obj.scale.z?.toFixed(2) || "1.00";
  }

  // Update material properties if it's a mesh
  if (obj instanceof RenderableMeshObject && obj.material) {
    const material = obj.material;
    if (material.color) {
      const colorHex = rgbToHex(material.color[0], material.color[1], material.color[2]);
      (document.getElementById("base-color-input") as HTMLInputElement).value = colorHex;
      (document.getElementById("base-color-swatch") as HTMLElement).style.backgroundColor = colorHex;
    }
    (document.getElementById("metallic-slider") as HTMLInputElement).value = (material.metallic || 0).toString();
    (document.getElementById("roughness-slider") as HTMLInputElement).value = (material.roughness || 0.5).toString();
    (document.getElementById("specular-slider") as HTMLInputElement).value = (material.specular || 16).toString();
    (document.getElementById("alpha-slider") as HTMLInputElement).value = (material.alpha || 1).toString();
    if (material.emissionColor) {
      const emissionHex = rgbToHex(material.emissionColor[0], material.emissionColor[1], material.emissionColor[2]);
      (document.getElementById("emission-color-input") as HTMLInputElement).value = emissionHex;
      (document.getElementById("emission-color-swatch") as HTMLElement).style.backgroundColor = emissionHex;
    }
    (document.getElementById("emission-intensity-slider") as HTMLInputElement).value = (material.emissionIntensity || 0).toString();
  }

  // Update light properties if it's a light
  const lightPanel = document.getElementById("light-properties-panel");
  if (obj instanceof PointLightNode || obj instanceof SpotLightNode || obj instanceof DirectionalLightNode) {
    if (lightPanel) lightPanel.style.display = "block";

    // Show/hide groups based on light type
    const positionGroup = document.getElementById("light-position-group");
    const directionGroup = document.getElementById("light-direction-group");
    const radiusGroup = document.getElementById("light-radius-group");
    const angleGroup = document.getElementById("light-angle-group");

    if (obj instanceof PointLightNode) {
      (document.getElementById("light-type") as HTMLElement).textContent = "Point Light";
      if (positionGroup) positionGroup.style.display = "block";
      if (directionGroup) directionGroup.style.display = "none";
      if (radiusGroup) radiusGroup.style.display = "block";
      if (angleGroup) angleGroup.style.display = "none";

      (document.getElementById("light-pos-x") as HTMLInputElement).value = obj.position.x.toFixed(2);
      (document.getElementById("light-pos-y") as HTMLInputElement).value = obj.position.y.toFixed(2);
      (document.getElementById("light-pos-z") as HTMLInputElement).value = obj.position.z.toFixed(2);

      (document.getElementById("light-radius-slider") as HTMLInputElement).value = obj.radius.toString();
      (document.getElementById("light-radius-value") as HTMLElement).textContent = obj.radius.toFixed(1);

      const colorHex = rgbToHex(obj.color[0], obj.color[1], obj.color[2]);
      (document.getElementById("light-color-input") as HTMLInputElement).value = colorHex;
      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = colorHex;

      (document.getElementById("light-intensity-slider") as HTMLInputElement).value = obj.intensity.toString();
      (document.getElementById("light-intensity-value") as HTMLElement).textContent = obj.intensity.toFixed(1);

    } else if (obj instanceof SpotLightNode) {
      (document.getElementById("light-type") as HTMLElement).textContent = "Spot Light";
      if (positionGroup) positionGroup.style.display = "block";
      if (directionGroup) directionGroup.style.display = "block";
      if (radiusGroup) radiusGroup.style.display = "none";
      if (angleGroup) angleGroup.style.display = "block";

      (document.getElementById("light-pos-x") as HTMLInputElement).value = obj.position.x.toFixed(2);
      (document.getElementById("light-pos-y") as HTMLInputElement).value = obj.position.y.toFixed(2);
      (document.getElementById("light-pos-z") as HTMLInputElement).value = obj.position.z.toFixed(2);

      (document.getElementById("light-dir-x") as HTMLInputElement).value = obj.direction[0].toFixed(2);
      (document.getElementById("light-dir-y") as HTMLInputElement).value = obj.direction[1].toFixed(2);
      (document.getElementById("light-dir-z") as HTMLInputElement).value = obj.direction[2].toFixed(2);

      const angleDegrees = (obj.angle * 180) / Math.PI;
      (document.getElementById("light-angle-slider") as HTMLInputElement).value = angleDegrees.toString();
      (document.getElementById("light-angle-value") as HTMLElement).textContent = Math.round(angleDegrees).toString();

      const colorHex = rgbToHex(obj.color[0], obj.color[1], obj.color[2]);
      (document.getElementById("light-color-input") as HTMLInputElement).value = colorHex;
      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = colorHex;

      (document.getElementById("light-intensity-slider") as HTMLInputElement).value = obj.intensity.toString();
      (document.getElementById("light-intensity-value") as HTMLElement).textContent = obj.intensity.toFixed(1);

    } else if (obj instanceof DirectionalLightNode) {
      (document.getElementById("light-type") as HTMLElement).textContent = "Directional Light";
      if (positionGroup) positionGroup.style.display = "none";
      if (directionGroup) directionGroup.style.display = "block";
      if (radiusGroup) radiusGroup.style.display = "none";
      if (angleGroup) angleGroup.style.display = "none";

      (document.getElementById("light-dir-x") as HTMLInputElement).value = obj.direction[0].toFixed(2);
      (document.getElementById("light-dir-y") as HTMLInputElement).value = obj.direction[1].toFixed(2);
      (document.getElementById("light-dir-z") as HTMLInputElement).value = obj.direction[2].toFixed(2);

      const colorHex = rgbToHex(obj.color[0], obj.color[1], obj.color[2]);
      (document.getElementById("light-color-input") as HTMLInputElement).value = colorHex;
      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = colorHex;

      (document.getElementById("light-intensity-slider") as HTMLInputElement).value = obj.intensity.toString();
      (document.getElementById("light-intensity-value") as HTMLElement).textContent = obj.intensity.toFixed(1);
    }
  } else {
    if (lightPanel) lightPanel.style.display = "none";
  }

  // Update camera properties if it's a camera
  if (obj === camera) {
    const cameraPanel = document.getElementById("camera-properties-panel");
    if (cameraPanel) cameraPanel.style.display = "block";
    const projType = (camera as any).projectionType || "perspective";
    (document.getElementById("camera-type") as HTMLElement).textContent = projType.charAt(0).toUpperCase() + projType.slice(1);
    (document.getElementById("camera-pos-x") as HTMLInputElement).value = isNaN(camera.eye.x) ? "0.00" : camera.eye.x.toFixed(2);
    (document.getElementById("camera-pos-y") as HTMLInputElement).value = isNaN(camera.eye.y) ? "0.00" : camera.eye.y.toFixed(2);
    (document.getElementById("camera-pos-z") as HTMLInputElement).value = isNaN(camera.eye.z) ? "0.00" : camera.eye.z.toFixed(2);
  } else {
    const cameraPanel = document.getElementById("camera-properties-panel");
    if (cameraPanel) cameraPanel.style.display = "none";
  }
}

// Helper function to convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Initialize scene graph
updateSceneGraph();

// Handle transform changes from UI
uiManager.onTransformChange((transform: any) => {
  if (selectedObject) {
    if (selectedObject instanceof SceneNode) {
      if (transform.position) {
        selectedObject.position.x = transform.position.x;
        selectedObject.position.y = transform.position.y;
        selectedObject.position.z = transform.position.z;
        selectedObject.updateLocalMatrix();
      }

      if (transform.rotation && !(selectedObject instanceof LightNode)) {
        selectedObject.rotate.x = transform.rotation.x;
        selectedObject.rotate.y = transform.rotation.y;
        selectedObject.rotate.z = transform.rotation.z;
        selectedObject.ObjectRotation();
      }

      if (transform.scale && !(selectedObject instanceof LightNode)) {
        selectedObject.scale.x = transform.scale.x;
        selectedObject.scale.y = transform.scale.y;
        selectedObject.scale.z = transform.scale.z;
        selectedObject.updateScale();
      }

      // Update gizmo
      if (events.gizmo && selectedObject instanceof RenderableMeshObject) {
        events.updateGizmoPosition(selectedObject);
      }
    } else if (selectedObject === camera) {
      if (transform.position) {
        camera.eye.x = transform.position.x;
        camera.eye.y = transform.position.y;
        camera.eye.z = transform.position.z;
        camera.OrbitCamera();
        events.updateOrbitParametersFromEye(camera);
      }
    }
  }
});

// Handle texture library selection
uiManager.onTextureSelect(async (type, url) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject) {
    try {
      if (url === "") {
        if (type === "texture") {
          selectedObject.texture = null;
          selectedObject.textureURL = null;
        } else {
          selectedObject.normalMap = null;
          selectedObject.normalMapURL = null;
        }
      } else {
        const textureData = await Texture.loadTextureAsync(url);
        if (type === "texture") {
          selectedObject.texture = textureData.texture;
          selectedObject.textureURL = textureData.base64Image;
        } else {
          selectedObject.normalMap = textureData.texture;
          selectedObject.normalMapURL = textureData.base64Image;
        }
      }
      // Force update
      selectedObject.geometryNeedsUpdate = true;
    } catch (error) {
      console.error(`Error handling unit library ${type}:`, error);
    }
  }
});

// Handle tool changes
uiManager.onToolChange((tool: string) => {
  if (events.gizmo) {
    if (tool === "select") {
      events.gizmo.visible = false;
    } else if (tool === "translate" || tool === "rotate" || tool === "scale") {
      // Show gizmo if an object is selected
      if (events.selectedObject) {
        events.gizmo.visible = true;
      }
      events.gizmo.setMode(tool as "translate" | "rotate" | "scale");
    }
  }
});

// Handle adding objects
uiManager.onAddObject((type: string, subtype: string) => {
  if (type === "mesh") {
    let geometryData: any = null;

    switch (subtype) {
      case "box":
        const boxGeometry = new BoxGeometryBuilder();
        geometryData = boxGeometry.CubeData();
        break;
      case "sphere":
        const sphereGeometry = new SphereGeometryBuilder();
        geometryData = sphereGeometry.SphereData();
        break;
      case "plane":
        const planeGeometry = new PlaneGeometryBuilder();
        geometryData = planeGeometry.PlaneData();
        break;
      case "cone":
        const coneGeometry = new ConeGeometryBuilder();
        geometryData = coneGeometry.ConeData(2.0, 1.0, 31);
        break;
      case "cylinder":
        const cylinderGeometry = new CylinderGeometryBuilder();
        geometryData = cylinderGeometry.CylinderData();
        break;
      default:
        return;
    }

    if (!geometryData) return;

    // Create a new material instance for each mesh to avoid shared references
    const meshMaterial = material.getMaterialProperties({
      color: MaterialColor.white,
      metallic: 0.5,
      roughness: 0.5,
      specular: 16.0,
      alpha: 1.0,
      emissionColor: [0.0, 0.0, 0.0],
      emissionIntensity: 0.0,
    });

    const mesh = new RenderableMeshObject(geometryData, meshMaterial);
    // Position mesh at origin (camera is looking at origin from z=10)
    mesh.position = { x: 0, y: 0, z: 0 };
    mesh.scale = { x: 1, y: 1, z: 1 };
    mesh.rotate = { x: 0, y: 0, z: 0 };
    mesh.updateTranslate();
    mesh.updateScale();
    // Update bounding box after setting position/scale
    if (mesh.updateBoundingBox) {
      mesh.updateBoundingBox();
    }
    // Ensure geometry needs update flag is set
    mesh.geometryNeedsUpdate = true;
    scene.add(mesh);
    createdObjects.set(mesh.uuid, mesh);
    updateSceneGraph();

    // Select the newly added mesh
    selectedObject = mesh;
    previousSelectedUUID = mesh.uuid;
    updateObjectProperties(mesh);

    // Also select it in the events system
    events.selectedObject = mesh;
    events.isObjectSelected = true;
    events.select = [mesh];
    if (events.webgl) {
      events.webgl.selectedObject = mesh;
    }
  } else if (type === "light") {
    // Add new light based on subtype as a SceneNode
    let newLight: LightNode | null = null;
    const lightIndex = scene.lights.length + 1;

    switch (subtype) {
      case "point":
        newLight = new PointLightNode(`Point Light`);
        newLight.position = { x: 0, y: 3, z: 0 };
        (newLight as PointLightNode).radius = 2.0;
        program = pointProgram;
        break;
      case "spot":
        newLight = new SpotLightNode(`Spot Light`);
        newLight.position = { x: 0, y: 0, z: 2 };
        (newLight as SpotLightNode).direction = [0, 0, -1];
        (newLight as SpotLightNode).angle = Math.PI / 5;
        program = spotProgram;
        break;
      case "directional":
        newLight = new DirectionalLightNode(`Directional Light`);
        (newLight as DirectionalLightNode).direction = [0, 0, 1];
        program = dirProgram;
        break;
    }

    if (newLight) {
      newLight.color = [1, 1, 1];
      newLight.intensity = 1.0;
      newLight.updateLocalMatrix();
      scene.add(newLight);

      // Select the newly added light
      selectedObject = newLight;
      previousSelectedUUID = newLight.uuid;
      updateObjectProperties(newLight);
      uiManager.selectObject(newLight.uuid);
    }

    gl.useProgram(program);
    updateSceneGraph();
  } else if (type === "camera") {
    // Camera is already created, just update type if needed
    if (subtype === "orthographic") {
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const size = 2.0; // Tighter bounds for better focus

      // Reset camera to front view for a truly flat orthographic look
      camera.eye = { x: 0, y: 0, z: 10 };
      camera.center = { x: 0, y: 0, z: 0 };
      camera.OrbitCamera();

      // Update orbit controller's internal state to match new eye
      if ((events as any).updateOrbitParametersFromEye) {
        (events as any).updateOrbitParametersFromEye(camera);
      }

      camera.OrthographicCamera(-size * aspect, size * aspect, -size, size, 0.1, 1000);
    } else {
      camera.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    }

    // Update UI if camera is selected
    if (selectedObject === camera) {
      updateObjectProperties(camera);
    }
    updateSceneGraph();
  }
});

// Handle New Scene
document.getElementById("new-scene-btn")?.addEventListener("click", () => {
  if (confirm("Create new scene? All unsaved changes will be lost.")) {
    // Clear scene objects
    scene.objects = [];
    createdObjects.clear();

    // Clear and re-add Grid
    gridGenerator = new GridHelper(currentGridSettings.size, currentGridSettings.spacing);
    gridMesh = new RenderableMeshObject(gridGenerator.createGrid());
    gridMesh.position = { x: 0, y: 0, z: 0 };
    gridMesh.updateTranslate();
    scene.add(gridMesh);

    // Re-add default cube
    const boxGeometry = new BoxGeometryBuilder();
    const cubeMaterial = material.getMaterialProperties({
      color: MaterialColor.red,
      metallic: 0.5,
      roughness: 0.5,
      specular: 16.0,
      alpha: 1.0,
      emissionColor: [0.0, 0.0, 0.0],
      emissionIntensity: 0.0,
    });
    const cube = new RenderableMeshObject(boxGeometry.CubeData(), cubeMaterial);
    cube.position = { x: 0, y: 0, z: 0 };
    cube.updateTranslate();
    scene.add(cube);

    // Reset master light to default
    masterLight.lightData.point.position = [];
    masterLight.lightData.point.radius = [];
    masterLight.lightData.point.color = [];
    masterLight.lightData.point.intensity = [];
    masterLight.lightData.spot.position = [];
    masterLight.lightData.spot.direction = [];
    masterLight.lightData.spot.angle = [];
    masterLight.lightData.spot.color = [];
    masterLight.lightData.spot.intensity = [];
    masterLight.lightData.directional.direction = [];
    masterLight.lightData.directional.color = [];
    masterLight.lightData.directional.intensity = [];

    masterLight.PointLight({
      lightPosition: [0.0, 0.0, 3.0],
      radius: 2.0,
      lightColor: [1.0, 1.0, 1.0],
      intensity: 2.0,
    });

    // Reset camera
    camera.eye = { x: 0, y: 0, z: 10 };
    camera.center = { x: 0, y: 0, z: 0 };
    camera.OrbitCamera();

    // Deselect
    selectedObject = null;
    previousSelectedUUID = null;
    events.selectedObject = null;
    events.isObjectSelected = false;
    events.select = [];
    if (events.gizmo) {
      events.gizmo.visible = false;
      events.gizmo.removeFromScene(scene);
    }

    updateSceneGraph();
  }
});

// Handle GLTF import
document.getElementById("import-gltf-btn")?.addEventListener("click", () => {
  const fileInput = document.getElementById("gltf-file-input") as HTMLInputElement;
  fileInput.click();
});

document.getElementById("gltf-file-input")?.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const url = URL.createObjectURL(file);
    try {
      await loader.main([url]);
      loader.buffer.forEach((meshData) => {
        loader.loadingGLTF(meshData, scene);
      });
      updateSceneGraph();
    } catch (error) {
      console.error("Error loading GLTF:", error);
    }
    URL.revokeObjectURL(url);
  }
});

// Handle GLTF export
document.getElementById("export-gltf-btn")?.addEventListener("click", () => {
  const gltfExport = new GLTFSceneExporter();
  const gltf = gltfExport.exportSceneToGLTF(scene);
  gltfExport.saveGLTF("exported_scene", gltf);
});

// Handle texture loading
document.getElementById("texture-file-input")?.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file && selectedObject && selectedObject instanceof RenderableMeshObject) {
    const url = URL.createObjectURL(file);
    try {
      const texture = await Texture.loadTextureAsync(url);
      selectedObject.texture = texture.texture;
      selectedObject.textureURL = texture.base64Image;
      // Force update
      selectedObject.geometryNeedsUpdate = true;
    } catch (error) {
      console.error("Error loading texture:", error);
    }
    (e.target as HTMLInputElement).value = ""; // Clear input so the same file can be selected again
    URL.revokeObjectURL(url);
  }
});

// Handle normal map loading
document.getElementById("normal-file-input")?.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file && selectedObject && selectedObject instanceof RenderableMeshObject) {
    const url = URL.createObjectURL(file);
    try {
      const normalMap = await Texture.loadTextureAsync(url);
      selectedObject.normalMap = normalMap.texture;
      selectedObject.normalMapURL = normalMap.base64Image;
      // Force update
      selectedObject.geometryNeedsUpdate = true;
    } catch (error) {
      console.error("Error loading normal map:", error);
    }
    (e.target as HTMLInputElement).value = ""; // Clear input so the same file can be selected again
    URL.revokeObjectURL(url);
  }
});

// Handle delete from scene graph
function deleteObjectFromScene(uuid: string) {
  const findNodeInScene = (nodes: SceneNode[], targetUuid: string): SceneNode | null => {
    for (const node of nodes) {
      if (node.uuid === targetUuid) return node;
      const found = findNodeInScene(node.children, targetUuid);
      if (found) return found;
    }
    return null;
  };

  const targetNode = findNodeInScene(scene.nodes, uuid);
  if (!targetNode) return;

  // Helper to recursively collect all descendant nodes
  const collectDescendants = (node: SceneNode, collected: SceneNode[]) => {
    collected.push(node);
    for (const child of node.children) {
      collectDescendants(child, collected);
    }
  };

  const nodesToRemove: SceneNode[] = [];
  collectDescendants(targetNode, nodesToRemove);

  // Perform removal for each node in the hierarchy
  for (const node of nodesToRemove) {
    // Remove from SceneHierarchyManager
    scene.remove(node);

    // Remove from internal EditorApplication maps
    createdObjects.delete(node.uuid);
    if (lightInstances.has(node.uuid)) {
      lightInstances.delete(node.uuid);
    }

    // Deselect if it was selected
    if (selectedObject === node) {
      selectedObject = null;
      previousSelectedUUID = null;

      // Clear viewport selection if it was a mesh
      if (node instanceof RenderableMeshObject) {
        events.selectedObject = null;
        events.isObjectSelected = false;
        events.select = [];
        if (events.gizmo) {
          events.gizmo.visible = false;
          events.gizmo.removeFromScene(scene);
        }
      }
    }
  }

  // Final UI update
  updateSceneGraph();
}

// Add delete functionality to scene graph items
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  const treeItem = target.closest(".tree-item") as HTMLElement;
  if (treeItem && treeItem.dataset.uuid) {
    e.preventDefault();
    if (confirm("Delete this object?")) {
      deleteObjectFromScene(treeItem.dataset.uuid);
    }
  }
});

// Add delete functionality with Delete key
document.addEventListener("keydown", (e) => {
  if (e.key === "Delete" && previousSelectedUUID) {
    // Confirm before deleting
    if (confirm("Delete selected object?")) {
      deleteObjectFromScene(previousSelectedUUID);
    }
  }
});

// Handle material property changes
document.getElementById("base-color-input")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject && selectedObject.material) {
    const hex = (e.target as HTMLInputElement).value;
    const rgb = hexToRgb(hex);
    if (rgb) {
      selectedObject.material.color = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
      (document.getElementById("base-color-swatch") as HTMLElement).style.backgroundColor = hex;
    }
  }
});

document.getElementById("metallic-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject && selectedObject.material) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.material.metallic = value;
    (document.getElementById("metallic-value") as HTMLElement).textContent = value.toFixed(2);
  }
});

document.getElementById("roughness-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject && selectedObject.material) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.material.roughness = value;
    (document.getElementById("roughness-value") as HTMLElement).textContent = value.toFixed(2);
  }
});

document.getElementById("specular-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject && selectedObject.material) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.material.specular = value;
    (document.getElementById("specular-value") as HTMLElement).textContent = value.toString();
  }
});

document.getElementById("alpha-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject && selectedObject.material) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.material.alpha = value;
    (document.getElementById("alpha-value") as HTMLElement).textContent = value.toFixed(2);
  }
});

document.getElementById("emission-color-input")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject && selectedObject.material) {
    const hex = (e.target as HTMLInputElement).value;
    const rgb = hexToRgb(hex);
    if (rgb) {
      selectedObject.material.emissionColor = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
      (document.getElementById("emission-color-swatch") as HTMLElement).style.backgroundColor = hex;
    }
  }
});

document.getElementById("emission-intensity-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject instanceof RenderableMeshObject && selectedObject.material) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.material.emissionIntensity = value;
    (document.getElementById("emission-intensity-value") as HTMLElement).textContent = value.toFixed(1);
  }
});

// Handle camera position changes
document.getElementById("camera-pos-x")?.addEventListener("input", (e) => {
  if (selectedObject === camera) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    camera.eye.x = value;
    camera.OrbitCamera();
    // Update orbit control parameters to match new camera position
    events.updateOrbitParametersFromEye(camera);
  }
});

document.getElementById("camera-pos-y")?.addEventListener("input", (e) => {
  if (selectedObject === camera) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    camera.eye.y = value;
    camera.OrbitCamera();
    // Update orbit control parameters to match new camera position
    events.updateOrbitParametersFromEye(camera);
  }
});

document.getElementById("camera-pos-z")?.addEventListener("input", (e) => {
  if (selectedObject === camera) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    camera.eye.z = value;
    camera.OrbitCamera();
    // Update orbit control parameters to match new camera position
    events.updateOrbitParametersFromEye(camera);
  }
});

// Handle light property changes
document.getElementById("light-pos-x")?.addEventListener("input", (e) => {
  if (selectedObject instanceof PointLightNode || selectedObject instanceof SpotLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.position.x = value;
    selectedObject.updateLocalMatrix();
  }
});

document.getElementById("light-pos-y")?.addEventListener("input", (e) => {
  if (selectedObject instanceof PointLightNode || selectedObject instanceof SpotLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.position.y = value;
    selectedObject.updateLocalMatrix();
  }
});

document.getElementById("light-pos-z")?.addEventListener("input", (e) => {
  if (selectedObject instanceof PointLightNode || selectedObject instanceof SpotLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.position.z = value;
    selectedObject.updateLocalMatrix();
  }
});

document.getElementById("light-color-input")?.addEventListener("input", (e) => {
  if (selectedObject instanceof PointLightNode || selectedObject instanceof SpotLightNode || selectedObject instanceof DirectionalLightNode) {
    const hex = (e.target as HTMLInputElement).value;
    const rgb = hexToRgb(hex);
    if (rgb) {
      selectedObject.color = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = hex;
    }
  }
});

document.getElementById("light-intensity-slider")?.addEventListener("input", (e) => {
  if (selectedObject instanceof PointLightNode || selectedObject instanceof SpotLightNode || selectedObject instanceof DirectionalLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.intensity = value;
    (document.getElementById("light-intensity-value") as HTMLElement).textContent = value.toFixed(1);
  }
});

// Handle light radius changes (Point Light)
document.getElementById("light-radius-slider")?.addEventListener("input", (e) => {
  if (selectedObject instanceof PointLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.radius = value;
    (document.getElementById("light-radius-value") as HTMLElement).textContent = value.toFixed(1);
  }
});

// Handle light angle changes (Spot Light)
document.getElementById("light-angle-slider")?.addEventListener("input", (e) => {
  if (selectedObject instanceof SpotLightNode) {
    const valueDegrees = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.angle = (valueDegrees * Math.PI) / 180;
    (document.getElementById("light-angle-value") as HTMLElement).textContent = Math.round(valueDegrees).toString();
  }
});

// Handle light direction changes (Spot and Directional Lights)
document.getElementById("light-dir-x")?.addEventListener("input", (e) => {
  if (selectedObject instanceof SpotLightNode || selectedObject instanceof DirectionalLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.direction[0] = value;
  }
});

document.getElementById("light-dir-y")?.addEventListener("input", (e) => {
  if (selectedObject instanceof SpotLightNode || selectedObject instanceof DirectionalLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.direction[1] = value;
  }
});

document.getElementById("light-dir-z")?.addEventListener("input", (e) => {
  if (selectedObject instanceof SpotLightNode || selectedObject instanceof DirectionalLightNode) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    selectedObject.direction[2] = value;
  }
});

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

// WebGL to WebGPU toggle (dummy)
document.getElementById("webgl-toggle")?.addEventListener("click", (e) => {
  const toggle = e.target as HTMLElement;
  toggle.classList.toggle("active");
  // Dummy functionality - no actual implementation
  console.log("WebGL/WebGPU toggle clicked (dummy)");
});

// Render loop
function animate() {

  const controls = events.controlEvent();
  events.updateUI(
    events,
    document.getElementById("object-uuid") as HTMLElement,
    document.getElementById("object-type") as HTMLElement
  );

  // Check if selection changed from viewport (mouse clicks)
  const currentViewportSelected = events.select && events.select.length > 0 ? events.select[0] : null;
  const currentViewportUUID = currentViewportSelected ? currentViewportSelected.uuid : null;

  // Only update if selection comes from viewport OR if selection was cleared in viewport
  // and we weren't already selecting something else (like a light) via the UI tree.
  if (currentViewportUUID !== null) {
    // Viewport selection took priority
    if (currentViewportUUID !== previousSelectedUUID) {
      previousSelectedUUID = currentViewportUUID;
      selectedObject = currentViewportSelected;
      updateObjectProperties(currentViewportSelected);
      updateSceneGraph();
    }
  } else if (previousSelectedUUID !== null) {
    // Viewport selection is empty. 
    // check if we have a "non-viewport" object selected (Camera or Light)
    const isPickByTree = selectedObject && (selectedObject instanceof LightNode || selectedObject === camera);

    if (!isPickByTree) {
      // Clear selection because viewport is empty and nothing special picked from tree
      selectedObject = null;
      previousSelectedUUID = null;
      // Clear properties
      (document.getElementById("object-type") as HTMLElement).textContent = "-";
      (document.getElementById("object-uuid") as HTMLElement).textContent = "-";
      updateSceneGraph();
    }
  }

  // If gizmo is being used, update properties panel in real-time
  if (events.isGizmoInteraction && selectedObject) {
    updateObjectProperties(selectedObject);
  }

  // Update camera
  camera.eye = { x: controls[0], y: controls[1], z: controls[2] };
  camera.OrbitCamera();

  // Update camera UI if camera is selected
  if (selectedObject === camera) {
    (document.getElementById("camera-pos-x") as HTMLInputElement).value = camera.eye.x.toFixed(2);
    (document.getElementById("camera-pos-y") as HTMLInputElement).value = camera.eye.y.toFixed(2);
    (document.getElementById("camera-pos-z") as HTMLInputElement).value = camera.eye.z.toFixed(2);
  }

  // Render
  webgl.Render(program, camera, scene);

  // Update status bar stats
  uiManager.updateStatusBar(webgl.getStats());

  // Update scene graph periodically
  if (frameCount % 60 === 0) {
    updateSceneGraph();
  }
  frameCount++;

  requestAnimationFrame(animate);
}

// Initialize scene graph
updateSceneGraph();

// Start render loop
animate();


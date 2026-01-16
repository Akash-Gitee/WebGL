import { EditorUIController } from "../../engine/UserInterface/EditorUIController.js";
import { WebGLRenderEngine } from "../../engine/RenderingPipeline/Webgl/WebGLRenderEngine.js";
import { CameraController } from "../../engine/CameraSystem/CameraController.js";
import { SceneHierarchyManager } from "../../engine/SceneGraph/SceneHierarchyManager.js";
import { PBRMaterialProperties } from "../../engine/MaterialSystem/PBRMaterialProperties.js";
import { TextureAssetLoader } from "../../engine/CoreUtilities/TextureAssetLoader.js";
import { GridHelper } from "../../engine/CoreUtilities/GridHelper.js";
import { RenderableMeshObject } from "../../engine/MeshRenderer/RenderableMeshObject.js";
import { BoxGeometryBuilder } from "../../engine/GeometryPrimitives/BoxGeometryBuilder.js";
import { SphereGeometryBuilder } from "../../engine/GeometryPrimitives/SphereGeometryBuilder.js";
import { PlaneGeometryBuilder } from "../../engine/GeometryPrimitives/PlaneGeometryBuilder.js";
import { ConeGeometryBuilder } from "../../engine/GeometryPrimitives/ConeGeometryBuilder.js";
import { CylinderGeometryBuilder } from "../../engine/GeometryPrimitives/CylinderGeometryBuilder.js";
import { SceneLightingManager } from "../../engine/LightingEngine/SceneLightingManager.js";
import { GLTFAssetLoader } from "../../engine/AssetImporter/GLTFAssetLoader.js";
import { SceneInteractionHandler } from "../../engine/EventManager/SceneInteractionHandler.js";
import { GLTFSceneExporter } from "../../engine/AssetImporter/GLTFSceneExporter.js";
import { createProgram } from "../../engine/RenderingPipeline/Webgl/ShaderProgramLinker.js";
import {
  PointLightvsSource, PointLightfsSource,
  SpotLightvsSource, SpotLightfsSource,
  DirLightvsSource, DirLightfsSource
} from "../../engine/RenderingPipeline/Shaders/GLSLShaderLibrary.js";


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

// Add default point light
masterLight.PointLight({
  lightPosition: [0.0, 0.0, 3.0],
  radius: 2.0,
  lightColor: [1.0, 1.0, 1.0],
  intensity: 2.0,
});

scene.add(masterLight);

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

  // Add meshes
  scene.objects.forEach((mesh: any) => {
    if (mesh.type !== "Grid-Geometry" && !mesh.isGizmoPart) {
      sceneObjects.push({
        uuid: mesh.uuid,
        name: mesh.type || "Mesh",
        type: "Mesh",
        children: mesh.children?.map((child: any) => ({
          uuid: child.uuid,
          name: child.type || "Mesh",
          type: "Mesh",
        })) || [],
      });
    }
  });

  // Add lights - track individual lights from the master light's arrays
  scene.lights.forEach((lightInstance: any) => {
    // For point lights
    for (let i = 0; i < lightInstance.lightData.point.position.length; i++) {
      const lightId = `${lightInstance.uuid}_point_${i}`;
      sceneObjects.push({
        uuid: lightId,
        name: `Point Light ${i + 1}`,
        type: "PointLight",
        lightInstance: lightInstance,
        lightIndex: i,
        lightType: "point",
      });
    }
    // For spot lights
    for (let i = 0; i < lightInstance.lightData.spot.position.length; i++) {
      const lightId = `${lightInstance.uuid}_spot_${i}`;
      sceneObjects.push({
        uuid: lightId,
        name: `Spot Light ${i + 1}`,
        type: "SpotLight",
        lightInstance: lightInstance,
        lightIndex: i,
        lightType: "spot",
      });
    }
    // For directional lights
    for (let i = 0; i < lightInstance.lightData.directional.direction.length; i++) {
      const lightId = `${lightInstance.uuid}_directional_${i}`;
      sceneObjects.push({
        uuid: lightId,
        name: `Directional Light ${i + 1}`,
        type: "DirectionalLight",
        lightInstance: lightInstance,
        lightIndex: i,
        lightType: "directional",
      });
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

  // Check lights - handle individual light instances
  if (!foundObject) {
    // Check if it's a light instance ID (format: uuid_type_index)
    const lightMatch = uuid.match(/^(.+)_(point|spot|directional)_(\d+)$/);
    if (lightMatch) {
      const [, lightUuid, lightType, indexStr] = lightMatch;
      const lightIndex = parseInt(indexStr, 10);

      for (const lightInstance of scene.lights) {
        if (lightInstance.uuid === lightUuid) {
          foundObject = {
            uuid: uuid,
            lightInstance: lightInstance,
            lightType: lightType,
            lightIndex: lightIndex,
            type: lightType === "point" ? "PointLight" : lightType === "spot" ? "SpotLight" : "DirectionalLight",
          };
          break;
        }
      }
    } else {
      // Check direct light UUID
      for (const light of scene.lights) {
        if (light.uuid === uuid) {
          foundObject = light;
          break;
        }
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
    if (foundObject.lightType === "point") {
      program = pointProgram;
    } else if (foundObject.lightType === "spot") {
      program = spotProgram;
    } else if (foundObject.lightType === "directional") {
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
        events.gizmo.position = { ...foundObject.position };
        events.gizmo.rotate = { x: 0, y: 0, z: 0 };
        events.gizmo.updateLocalMatrix();
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
  const pos = obj.position || obj.eye;
  if (pos) {
    (document.getElementById("pos-x") as HTMLInputElement).value = pos.x?.toFixed(2) || "0.00";
    (document.getElementById("pos-y") as HTMLInputElement).value = pos.y?.toFixed(2) || "0.00";
    (document.getElementById("pos-z") as HTMLInputElement).value = pos.z?.toFixed(2) || "0.00";
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
  if (obj.lightInstance && obj.lightType && obj.lightIndex !== undefined) {
    const lightPanel = document.getElementById("light-properties-panel");
    if (lightPanel) lightPanel.style.display = "block";
    const lightInstance = obj.lightInstance;
    const lightType = obj.lightType;
    const index = obj.lightIndex;

    // Show/hide groups based on light type
    const positionGroup = document.getElementById("light-position-group");
    const directionGroup = document.getElementById("light-direction-group");
    const radiusGroup = document.getElementById("light-radius-group");
    const angleGroup = document.getElementById("light-angle-group");

    if (lightType === "point") {
      (document.getElementById("light-type") as HTMLElement).textContent = "Point Light";
      if (positionGroup) positionGroup.style.display = "block";
      if (directionGroup) directionGroup.style.display = "none";
      if (radiusGroup) radiusGroup.style.display = "block";
      if (angleGroup) angleGroup.style.display = "none";

      const pos = lightInstance.lightData.point.position[index];
      const color = lightInstance.lightData.point.color[index];
      const intensity = lightInstance.lightData.point.intensity[index];
      const radius = lightInstance.lightData.point.radius[index];

      (document.getElementById("light-pos-x") as HTMLInputElement).value = pos[0].toFixed(2);
      (document.getElementById("light-pos-y") as HTMLInputElement).value = pos[1].toFixed(2);
      (document.getElementById("light-pos-z") as HTMLInputElement).value = pos[2].toFixed(2);

      (document.getElementById("light-radius-slider") as HTMLInputElement).value = radius.toString();
      (document.getElementById("light-radius-value") as HTMLElement).textContent = radius.toFixed(1);

      const colorHex = rgbToHex(color[0], color[1], color[2]);
      (document.getElementById("light-color-input") as HTMLInputElement).value = colorHex;
      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = colorHex;

      (document.getElementById("light-intensity-slider") as HTMLInputElement).value = intensity.toString();
      (document.getElementById("light-intensity-value") as HTMLElement).textContent = intensity.toFixed(1);

    } else if (lightType === "spot") {
      (document.getElementById("light-type") as HTMLElement).textContent = "Spot Light";
      if (positionGroup) positionGroup.style.display = "block";
      if (directionGroup) directionGroup.style.display = "block";
      if (radiusGroup) radiusGroup.style.display = "none";
      if (angleGroup) angleGroup.style.display = "block";

      const pos = lightInstance.lightData.spot.position[index];
      const dir = lightInstance.lightData.spot.direction[index];
      const color = lightInstance.lightData.spot.color[index];
      const intensity = lightInstance.lightData.spot.intensity[index];
      const angle = lightInstance.lightData.spot.angle[index];

      (document.getElementById("light-pos-x") as HTMLInputElement).value = pos[0].toFixed(2);
      (document.getElementById("light-pos-y") as HTMLInputElement).value = pos[1].toFixed(2);
      (document.getElementById("light-pos-z") as HTMLInputElement).value = pos[2].toFixed(2);

      (document.getElementById("light-dir-x") as HTMLInputElement).value = dir[0].toFixed(2);
      (document.getElementById("light-dir-y") as HTMLInputElement).value = dir[1].toFixed(2);
      (document.getElementById("light-dir-z") as HTMLInputElement).value = dir[2].toFixed(2);

      const angleDegrees = (angle * 180) / Math.PI;
      (document.getElementById("light-angle-slider") as HTMLInputElement).value = angleDegrees.toString();
      (document.getElementById("light-angle-value") as HTMLElement).textContent = Math.round(angleDegrees).toString();

      const colorHex = rgbToHex(color[0], color[1], color[2]);
      (document.getElementById("light-color-input") as HTMLInputElement).value = colorHex;
      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = colorHex;

      (document.getElementById("light-intensity-slider") as HTMLInputElement).value = intensity.toString();
      (document.getElementById("light-intensity-value") as HTMLElement).textContent = intensity.toFixed(1);

    } else if (lightType === "directional") {
      (document.getElementById("light-type") as HTMLElement).textContent = "Directional Light";
      if (positionGroup) positionGroup.style.display = "none";
      if (directionGroup) directionGroup.style.display = "block";
      if (radiusGroup) radiusGroup.style.display = "none";
      if (angleGroup) angleGroup.style.display = "none";

      const dir = lightInstance.lightData.directional.direction[index];
      const color = lightInstance.lightData.directional.color[index];
      const intensity = lightInstance.lightData.directional.intensity[index];

      (document.getElementById("light-dir-x") as HTMLInputElement).value = dir[0].toFixed(2);
      (document.getElementById("light-dir-y") as HTMLInputElement).value = dir[1].toFixed(2);
      (document.getElementById("light-dir-z") as HTMLInputElement).value = dir[2].toFixed(2);

      const colorHex = rgbToHex(color[0], color[1], color[2]);
      (document.getElementById("light-color-input") as HTMLInputElement).value = colorHex;
      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = colorHex;

      (document.getElementById("light-intensity-slider") as HTMLInputElement).value = intensity.toString();
      (document.getElementById("light-intensity-value") as HTMLElement).textContent = intensity.toFixed(1);
    }
  } else {
    const lightPanel = document.getElementById("light-properties-panel");
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

// Handle transform changes from UI
uiManager.onTransformChange((transform: any) => {
  if (selectedObject) {
    if (selectedObject instanceof RenderableMeshObject) {
      // Update position
      if (transform.position) {
        selectedObject.position.x = transform.position.x;
        selectedObject.position.y = transform.position.y;
        selectedObject.position.z = transform.position.z;
        selectedObject.updateTranslate();
      }

      // Update rotation
      if (transform.rotation) {
        selectedObject.rotate.x = transform.rotation.x;
        selectedObject.rotate.y = transform.rotation.y;
        selectedObject.rotate.z = transform.rotation.z;
        selectedObject.ObjectRotation();
      }

      // Update scale
      if (transform.scale) {
        selectedObject.scale.x = transform.scale.x;
        selectedObject.scale.y = transform.scale.y;
        selectedObject.scale.z = transform.scale.z;
        selectedObject.updateScale();
      }

      // Update gizmo position
      if (events.gizmo) {
        events.gizmo.position = { ...selectedObject.position };
        events.gizmo.updateLocalMatrix();
      }
    } else if (selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
      // Handle light position updates
      const lightInstance = selectedObject.lightInstance;
      const lightType = selectedObject.lightType;
      const index = selectedObject.lightIndex;

      if (transform.position) {
        if (lightType === "point" && lightInstance.lightData.point.position[index]) {
          lightInstance.lightData.point.position[index][0] = transform.position.x;
          lightInstance.lightData.point.position[index][1] = transform.position.y;
          lightInstance.lightData.point.position[index][2] = transform.position.z;
        } else if (lightType === "spot" && lightInstance.lightData.spot.position[index]) {
          lightInstance.lightData.spot.position[index][0] = transform.position.x;
          lightInstance.lightData.spot.position[index][1] = transform.position.y;
          lightInstance.lightData.spot.position[index][2] = transform.position.z;
        } else if (lightType === "directional" && lightInstance.lightData.directional.direction[index]) {
          lightInstance.lightData.directional.direction[index][0] = transform.position.x;
          lightInstance.lightData.directional.direction[index][1] = transform.position.y;
          lightInstance.lightData.directional.direction[index][2] = transform.position.z;
        }
      }
    } else if (selectedObject === camera) {
      // Handle camera position updates
      if (transform.position) {
        camera.eye.x = transform.position.x;
        camera.eye.y = transform.position.y;
        camera.eye.z = transform.position.z;
        camera.OrbitCamera();
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
    // Add new light based on subtype to the master light
    switch (subtype) {
      case "point":
        masterLight.PointLight({
          lightPosition: [0.0, 3.0, 0.0],
          radius: 2.0,
          lightColor: [1.0, 1.0, 1.0],
          intensity: 1.0,
        });
        program = pointProgram;
        break;
      case "spot":
        masterLight.SpotLight({
          lightPosition: [0.0, 0.0, 2.0],
          spotLightDirection: [0.0, 0.0, -1.0],
          spotLightAngle: Math.PI / 5,
          lightColor: [1.0, 1.0, 1.0],
          intensity: 1.0,
        });
        program = spotProgram;
        break;
      case "directional":
        masterLight.DirectionalLight({
          lightDirection: [0.0, 0.0, 1.0],
          lightColor: [1.0, 1.0, 1.0],
          intensity: 1.0,
        });
        program = dirProgram;
        break;
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
  // Check if it's a mesh
  for (let i = 0; i < scene.objects.length; i++) {
    if (scene.objects[i].uuid === uuid) {
      const mesh = scene.objects[i];
      // Remove from scene
      scene.objects.splice(i, 1);
      // Remove from createdObjects
      createdObjects.delete(uuid);
      // Deselect if it was selected
      if (selectedObject === mesh) {
        selectedObject = null;
        previousSelectedUUID = null;
        events.selectedObject = null;
        events.isObjectSelected = false;
        events.select = [];
        if (events.gizmo) {
          events.gizmo.visible = false;
          events.gizmo.removeFromScene(scene);
        }
      }
      updateSceneGraph();
      return;
    }
  }

  // Check if it's a light
  const lightMatch = uuid.match(/^(.+)_(point|spot|directional)_(\d+)$/);
  if (lightMatch) {
    const [, lightUuid, lightType, indexStr] = lightMatch;
    const lightIndex = parseInt(indexStr, 10);

    for (const lightInstance of scene.lights) {
      if (lightInstance.uuid === lightUuid) {
        if (lightType === "point" && lightInstance.lightData.point.position.length > lightIndex) {
          lightInstance.lightData.point.position.splice(lightIndex, 1);
          lightInstance.lightData.point.radius.splice(lightIndex, 1);
          lightInstance.lightData.point.color.splice(lightIndex, 1);
          lightInstance.lightData.point.intensity.splice(lightIndex, 1);
        } else if (lightType === "spot" && lightInstance.lightData.spot.position.length > lightIndex) {
          lightInstance.lightData.spot.position.splice(lightIndex, 1);
          lightInstance.lightData.spot.direction.splice(lightIndex, 1);
          lightInstance.lightData.spot.angle.splice(lightIndex, 1);
          lightInstance.lightData.spot.color.splice(lightIndex, 1);
          lightInstance.lightData.spot.intensity.splice(lightIndex, 1);
        } else if (lightType === "directional" && lightInstance.lightData.directional.direction.length > lightIndex) {
          lightInstance.lightData.directional.direction.splice(lightIndex, 1);
          lightInstance.lightData.directional.color.splice(lightIndex, 1);
          lightInstance.lightData.directional.intensity.splice(lightIndex, 1);
        }

        // Deselect if it was selected
        if (selectedObject && selectedObject.uuid === uuid) {
          selectedObject = null;
          previousSelectedUUID = null;
        }
        updateSceneGraph();
        return;
      }
    }
  }
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
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const lightType = selectedObject.lightType;
    const index = selectedObject.lightIndex;

    if (lightType === "point" && lightInstance.lightData.point.position[index]) {
      lightInstance.lightData.point.position[index][0] = value;
    } else if (lightType === "spot" && lightInstance.lightData.spot.position[index]) {
      lightInstance.lightData.spot.position[index][0] = value;
    } else if (lightType === "directional" && lightInstance.lightData.directional.direction[index]) {
      lightInstance.lightData.directional.direction[index][0] = value;
    }
  }
});

document.getElementById("light-pos-y")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const lightType = selectedObject.lightType;
    const index = selectedObject.lightIndex;

    if (lightType === "point" && lightInstance.lightData.point.position[index]) {
      lightInstance.lightData.point.position[index][1] = value;
    } else if (lightType === "spot" && lightInstance.lightData.spot.position[index]) {
      lightInstance.lightData.spot.position[index][1] = value;
    } else if (lightType === "directional" && lightInstance.lightData.directional.direction[index]) {
      lightInstance.lightData.directional.direction[index][1] = value;
    }
  }
});

document.getElementById("light-pos-z")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const lightType = selectedObject.lightType;
    const index = selectedObject.lightIndex;

    if (lightType === "point" && lightInstance.lightData.point.position[index]) {
      lightInstance.lightData.point.position[index][2] = value;
    } else if (lightType === "spot" && lightInstance.lightData.spot.position[index]) {
      lightInstance.lightData.spot.position[index][2] = value;
    } else if (lightType === "directional" && lightInstance.lightData.directional.direction[index]) {
      lightInstance.lightData.directional.direction[index][2] = value;
    }
  }
});

document.getElementById("light-color-input")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const hex = (e.target as HTMLInputElement).value;
    const rgb = hexToRgb(hex);
    if (rgb) {
      const color = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
      const lightInstance = selectedObject.lightInstance;
      const lightType = selectedObject.lightType;
      const index = selectedObject.lightIndex;

      if (lightType === "point" && lightInstance.lightData.point.color[index]) {
        lightInstance.lightData.point.color[index][0] = color[0];
        lightInstance.lightData.point.color[index][1] = color[1];
        lightInstance.lightData.point.color[index][2] = color[2];
      } else if (lightType === "spot" && lightInstance.lightData.spot.color[index]) {
        lightInstance.lightData.spot.color[index][0] = color[0];
        lightInstance.lightData.spot.color[index][1] = color[1];
        lightInstance.lightData.spot.color[index][2] = color[2];
      } else if (lightType === "directional" && lightInstance.lightData.directional.color[index]) {
        lightInstance.lightData.directional.color[index][0] = color[0];
        lightInstance.lightData.directional.color[index][1] = color[1];
        lightInstance.lightData.directional.color[index][2] = color[2];
      }

      (document.getElementById("light-color-swatch") as HTMLElement).style.backgroundColor = hex;
    }
  }
});

// Light color swatch click handler
document.getElementById("light-color-swatch")?.addEventListener("click", () => {
  document.getElementById("light-color-input")?.click();
});

document.getElementById("light-intensity-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const lightType = selectedObject.lightType;
    const index = selectedObject.lightIndex;

    if (lightType === "point" && lightInstance.lightData.point.intensity[index] !== undefined) {
      lightInstance.lightData.point.intensity[index] = value;
    } else if (lightType === "spot" && lightInstance.lightData.spot.intensity[index] !== undefined) {
      lightInstance.lightData.spot.intensity[index] = value;
    } else if (lightType === "directional" && lightInstance.lightData.directional.intensity[index] !== undefined) {
      lightInstance.lightData.directional.intensity[index] = value;
    }

    (document.getElementById("light-intensity-value") as HTMLElement).textContent = value.toFixed(1);
  }
});

// Handle light radius changes (Point Light)
document.getElementById("light-radius-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType === "point" && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const index = selectedObject.lightIndex;

    if (lightInstance.lightData.point.radius[index] !== undefined) {
      lightInstance.lightData.point.radius[index] = value;
      (document.getElementById("light-radius-value") as HTMLElement).textContent = value.toFixed(1);
    }
  }
});

// Handle light angle changes (Spot Light)
document.getElementById("light-angle-slider")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType === "spot" && selectedObject.lightIndex !== undefined) {
    const valueDegrees = parseFloat((e.target as HTMLInputElement).value);
    const valueRadians = (valueDegrees * Math.PI) / 180;
    const lightInstance = selectedObject.lightInstance;
    const index = selectedObject.lightIndex;

    if (lightInstance.lightData.spot.angle[index] !== undefined) {
      lightInstance.lightData.spot.angle[index] = valueRadians;
      (document.getElementById("light-angle-value") as HTMLElement).textContent = Math.round(valueDegrees).toString();
    }
  }
});

// Handle light direction changes (Spot and Directional Lights)
document.getElementById("light-dir-x")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const lightType = selectedObject.lightType;
    const index = selectedObject.lightIndex;

    if (lightType === "spot" && lightInstance.lightData.spot.direction[index]) {
      lightInstance.lightData.spot.direction[index][0] = value;
    } else if (lightType === "directional" && lightInstance.lightData.directional.direction[index]) {
      lightInstance.lightData.directional.direction[index][0] = value;
    }
  }
});

document.getElementById("light-dir-y")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const lightType = selectedObject.lightType;
    const index = selectedObject.lightIndex;

    if (lightType === "spot" && lightInstance.lightData.spot.direction[index]) {
      lightInstance.lightData.spot.direction[index][1] = value;
    } else if (lightType === "directional" && lightInstance.lightData.directional.direction[index]) {
      lightInstance.lightData.directional.direction[index][1] = value;
    }
  }
});

document.getElementById("light-dir-z")?.addEventListener("input", (e) => {
  if (selectedObject && selectedObject.lightInstance && selectedObject.lightType && selectedObject.lightIndex !== undefined) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    const lightInstance = selectedObject.lightInstance;
    const lightType = selectedObject.lightType;
    const index = selectedObject.lightIndex;

    if (lightType === "spot" && lightInstance.lightData.spot.direction[index]) {
      lightInstance.lightData.spot.direction[index][2] = value;
    } else if (lightType === "directional" && lightInstance.lightData.directional.direction[index]) {
      lightInstance.lightData.directional.direction[index][2] = value;
    }
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
    const isPickByTree = selectedObject && (selectedObject.lightInstance || selectedObject === camera);

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


# WebGL 3D Engine Library

A powerful, TypeScript-based WebGL library for creating interactive 3D graphics and scenes with an integrated visual editor.

## Features

### Core Engine
- **WebGL Rendering**: High-performance WebGL-based rendering engine
- **Scene Management**: Comprehensive scene graph with hierarchical object management
- **Camera System**: Perspective and orthographic camera support with interactive controls
- **Material System**: PBR (Physically Based Rendering) materials with customizable properties
  - Base color, metallic, roughness, specular
  - Emission color and intensity
  - Alpha transparency support
- **Lighting System**: Multiple light types with full control
  - Point lights
  - Spot lights
  - Directional lights
- **Geometry Primitives**: Built-in geometric shapes
  - Box, Sphere, Plane, Cone, Cylinder
- **Transform Controls**: Interactive gizmos for translate, rotate, and scale operations
- **Texture Support**: Load and apply textures and normal maps
- **GLTF Import/Export**: Full support for importing and exporting GLTF/GLB models

### Advanced Features
- **Frustum Culling**: Automatic optimization for rendering only visible objects
- **Grid Helper**: Visual grid for spatial reference
- **UUID System**: Unique identification for all scene objects
- **Event System**: Custom event handling for user interactions
- **UI Manager**: Integrated UI system for building interactive interfaces

### Visual Editor
A complete 3D editor with:
- **Scene Graph View**: Hierarchical visualization of scene objects
- **Property Panels**: Real-time editing of object, material, light, and camera properties
- **Transform Tools**: Visual gizmos for object manipulation
- **Menu System**: File operations, object creation, and scene management
- **Status Bar**: Real-time FPS and draw call monitoring
- **Dark Theme UI**: Modern, professional interface design

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone <repository-url>

# Navigate to project directory
cd WebGL-main

# Install dependencies
npm install
```

## Usage

### Development Mode
Start the development server with hot reload:
```bash
npm start
```
The editor will be available at `http://localhost:8080`

### Build for Production
Compile TypeScript and bundle the project:
```bash
npm run build
```

### Watch Mode
Automatically recompile TypeScript files on changes:
```bash
npm run watch
```

## Project Structure

```
WebGL-main/
├── engine/                    # Source code
│   ├── CameraSystem/         # Camera implementation
│   ├── EventManager/         # Event system
│   ├── AssetImporter/        # GLTF import/export
│   ├── GeometryPrimitives/   # Geometric primitives
│   ├── LightingEngine/       # Lighting system
│   ├── MaterialSystem/       # Material system
│   ├── MathLibrary/          # Math utilities (Matrix4, etc.)
│   ├── MeshRenderer/         # Mesh objects
│   ├── RenderingPipeline/    # WebGL rendering engine
│   │   └── Shaders/          # GLSL shaders
│   ├── SceneGraph/           # Scene management
│   ├── CoreUtilities/        # Helper tools (Grid, TransformControls, etc.)
│   ├── UserInterface/        # UI system
│   ├── IdentifierSystem/     # UUID generation
│   └── AssetResources/       # Asset management
├── Showcase/                 # Example implementations
│   └── 3DEditor/             # Full-featured 3D editor
├── dist/                     # Compiled output
├── package.json              # Project dependencies
└── tsconfig.json             # TypeScript configuration
```

## Quick Start Example

### Basic Scene Setup
```typescript
import { WebGLRenderEngine } from './engine/RenderingPipeline/Webgl/WebGLRenderEngine.js';
import { SceneHierarchyManager } from './engine/SceneGraph/SceneHierarchyManager.js';
import { CameraController } from './engine/CameraSystem/CameraController.js';
import { RenderableMeshObject } from './engine/MeshRenderer/RenderableMeshObject.js';
import { BoxGeometryBuilder } from './engine/GeometryPrimitives/BoxGeometryBuilder.js';
import { PBRMaterialProperties } from './engine/MaterialSystem/PBRMaterialProperties.js';
import { SceneLightingManager } from './engine/LightingEngine/SceneLightingManager.js';
import { createProgram } from './engine/RenderingPipeline/Webgl/ShaderProgramLinker.js';
import { PointLightvsSource, PointLightfsSource } from './engine/RenderingPipeline/Shaders/GLSLShaderLibrary.js';

// Initialize WebGL renderer
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const webgl = new WebGLRenderEngine(canvas);

// Create scene
const scene = new SceneHierarchyManager();

// Create camera
const camera = new CameraController();
const aspect = canvas.clientWidth / canvas.clientHeight;
camera.PerspectiveCamera(45, aspect, 0.1, 1000);
camera.OrbitCamera();

// Create a mesh
const boxGeometry = new BoxGeometryBuilder();
const material = new PBRMaterialProperties();
const materialColor = material.BaseColors();

const cubeMaterial = material.getMaterialProperties({
  color: materialColor.red,
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

// Add lighting
const gl = webgl.gl;
let program = createProgram(gl, PointLightvsSource as string, PointLightfsSource as string);
gl.useProgram(program);

const light = new SceneLightingManager(gl, program);
light.lightType = 'point';
light.BaseLight({
  ambientLight: [0.2, 0.2, 0.2],
  diffuseLight: [1.0, 1.0, 1.0],
  specularLight: [1.0, 1.0, 1.0],
});
light.PointLight({
  lightPosition: [3.0, 2.0, 3.0],
  radius: 2.0,
  lightColor: [1.0, 1.0, 1.0],
  intensity: 1.5,
});
scene.add(light);

// Render loop
function animate() {
  cube.rotate.y += 0.01;
  cube.ObjectRotation();
  webgl.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

## API Overview

### Core Classes

#### WebGLRenderEngine
Main rendering engine
- `render(scene, camera)` - Render the scene
- `resize(width, height)` - Resize the canvas
- `gl` - WebGL context

#### SceneHierarchyManager
Scene graph container
- `add(object)` - Add object to scene
- `remove(object)` - Remove object from scene
- `objects` - Array of mesh objects
- `lights` - Array of light objects

#### CameraController
Camera for viewing the scene
- `PerspectiveCamera(fov, aspect, near, far)` - Set perspective projection
- `OrthographicCamera(left, right, bottom, top, near, far)` - Set orthographic projection
- `OrbitCamera()` - Enable orbit controls
- `eye` - Camera position {x, y, z}

#### RenderableMeshObject
3D object combining geometry and material
- `position` - Object position {x, y, z}
- `rotate` - Object rotation {x, y, z}
- `scale` - Object scale {x, y, z}
- `updateTranslate()` - Apply position changes
- `ObjectRotation()` - Apply rotation changes
- `updateScale()` - Apply scale changes

#### PBRMaterialProperties
Material properties for rendering
- `getMaterialProperties(config)` - Create material with properties
- `BaseColors()` - Get predefined color palette
- Properties: `color`, `metallic`, `roughness`, `specular`, `alpha`, `emissionColor`, `emissionIntensity`

#### SceneLightingManager
Light source manager
- `lightType` - Type: `'point'`, `'spot'`, `'directional'`
- `BaseLight(config)` - Set ambient, diffuse, specular lighting
- `PointLight(config)` - Add point light
- `SpotLight(config)` - Add spot light
- `DirectionalLight(config)` - Add directional light

### Geometry Classes
- `BoxGeometryBuilder` - `.CubeData()` - Create box geometry
- `SphereGeometryBuilder` - `.SphereData()` - Create sphere geometry
- `PlaneGeometryBuilder` - `.PlaneData()` - Create plane geometry
- `ConeGeometryBuilder` - `.ConeData(height, radius, segments)` - Create cone geometry
- `CylinderGeometryBuilder` - `.CylinderData()` - Create cylinder geometry

### Tools
- `GridHelper(size, spacing)` - Visual grid helper
- `TransformGizmoController(camera, canvas)` - Interactive transform gizmos
- `TextureAssetLoader(gl, scene)` - Load textures
  - `.loadTextureAsync(url)` - Load texture from URL
- `GLTFAssetLoader(gl, scene)` - Import GLTF/GLB models
  - `.main([urls])` - Load GLTF files
  - `.loadingGLTF(meshData, scene)` - Add to scene
- `GLTFSceneExporter()` - Export scene to GLTF
  - `.exportSceneToGLTF(scene)` - Export scene
  - `.saveGLTF(filename, gltf)` - Save to file

## Examples

The `Showcase/` directory contains various demonstrations:

- **3DEditor** - Full-featured 3D editor with UI

To run an example, open the corresponding HTML file in the `Showcase/` directory with a live server.

## Development

### Technology Stack
- **TypeScript** - Type-safe development
- **WebGL** - Graphics rendering
- **Webpack** - Module bundling
- **Webpack Dev Server** - Development server

### TypeScript Configuration
- Target: ES2016
- Module: ESNext
- Strict mode enabled
- Source maps generated
- Output: `./dist`

## UI System

The library includes a comprehensive UI system with:
- Dark theme with CSS custom properties
- Reusable components (buttons, inputs, panels, dropdowns)
- Color pickers and sliders
- Tree view for scene graph
- Property panels for object editing

## Contact

For questions and support, please open an issue on the repository.

---

Built with TypeScript and WebGL

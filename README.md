# 🎮 WebGL 3D Engine & Editor

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

A high-performance, modular 3D engine built from the ground up with **Pure WebGL** and **TypeScript**. This project features a robust rendering pipeline, a comprehensive scene graph, and a fully integrated visual editor for real-time 3D scene composition.

🚀 **[View Live Demo](https://webgleditor-seven.vercel.app/)**

---

## ✨ Key Features

### 🏗️ Core Rendering Architecture
- **Pure WebGL Pipeline**: Low-level implementation of the rendering lifecycle without external wrappers.
- **PBR (Physically Based Rendering)**: Advanced material system supporting Metallic-Roughness workflow, specular mapping, and emissive properties.
- **Dynamic Lighting**: Real-time support for Point, Spot, and Directional lights with specialized GLSL shaders.
- **Frustum Culling**: Optimized rendering that identifies and skips objects outside the camera's view.
- **Hierarchical Scene Graph**: Powerful parent-child relationship management for complex 3D transformations.

### 🛠️ Professional Visual Editor
- **Real-time Scene Tree**: Hierarchical visualization and management of all scene nodes.
- **Live Property Inspector**: Instant manipulation of transforms, materials, lights, and camera settings.
- **Interactive Gizmos**: Industry-standard visual controls for Move (Translate), Rotate, and Scale operations.
- **Asset Management**: Seamless GLTF/GLB import/export and dynamic texture library supporting normal maps.
- **Performance Monitoring**: Integrated real-time FPS and draw call statistics.

---

## 📂 Project Architecture

The project is architected with modularity and scalability in mind:

```text
WebGL-Engine/
├── 🚀 Showcase/             # Live implementations and Editor UI
├── ⚙️ engine/               # Core Engine Systems
│   ├── RenderingPipeline/   # WebGL context, Shader linking, and GLSL library
│   ├── MaterialSystem/      # PBR Material definitions
│   ├── LightingEngine/      # Dynamic light management
│   ├── CameraSystem/        # Perspective & Orthographic controllers
│   ├── GeometryPrimitives/  # Procedural geometry generation
│   ├── AssetImporter/       # GLTF/GLB serialization
│   └── UserInterface/       # Integrated Editor UI framework
└── 📦 dist/                 # Optimized production bundles
```

---

## 🛠️ Tech Stack

- **Language**: TypeScript (Strict Mode)
- **Graphics API**: WebGL 2.0 / 1.0
- **Bundler**: Webpack 5
- **Tooling**: Webpack Dev Server, TS-Loader
- **Deployment**: Vercel

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/Akash-Gitee/WebGL.git

# Navigate to project
cd WebGL

# Install dependencies
npm install
```

### Running Locally
```bash
# Start the development server (with Hot Reload)
npm run start
```
Access the editor at `http://localhost:8081`

### Building for Production
```bash
# Generate optimized bundles
npm run build
```

---

## 💡 Usage Example: Programmatic Scene Setup

```typescript
import { WebGLRenderEngine } from './engine/RenderingPipeline/Webgl/WebGLRenderEngine';
import { SceneHierarchyManager } from './engine/SceneGraph/SceneHierarchyManager';
import { CameraController } from './engine/CameraSystem/CameraController';
import { RenderableMeshObject } from './engine/MeshRenderer/RenderableMeshObject';

// 1. Initialize Engine
const canvas = document.getElementById('Mycanvas') as HTMLCanvasElement;
const webgl = new WebGLRenderEngine(canvas);
const scene = new SceneHierarchyManager();

// 2. Setup Camera
const camera = new CameraController();
camera.PerspectiveCamera(45, canvas.width/canvas.height, 0.1, 1000);
camera.OrbitCamera();

// 3. Add Geometry
const box = new RenderableMeshObject(new BoxGeometryBuilder().CubeData());
scene.add(box);

// 4. Render Loop
const animate = () => {
  webgl.render(scene, camera);
  requestAnimationFrame(animate);
};
animate();
```

---

## 🚀 Future Roadmap

I am actively developing this engine to bridge the gap between pure WebGL and high-level 3D frameworks. Upcoming milestones include:

- [ ] **Advanced Lighting**: Real-time Shadow Mapping (Cascaded Shadow Maps) and Screen Space Ambient Occlusion (SSAO).
- [ ] **Animation System**: Skinned mesh animation support for rigged character models.
- [ ] **Post-Processing Pipeline**: Integrated passes for Bloom, HDR Tone Mapping, and Depth of Field.
- [ ] **WebGPU Support**: Implementing a parallel rendering backend for the next-generation web graphics API.
- [ ] **Physics Integration**: Integration with a physics engine (like Rapier or Cannon.js) for rigid body dynamics.
- [ ] **Advanced Materials**: Support for Clearcoat, Sheen, and Iridescence based on the latest GLTF extensions.

---

## 🤝 Contact & Support

This project is open for collaboration! If you're a developer or recruiter interested in the technical implementation:
- **GitHub**: [Akash-Gitee](https://github.com/Akash-Gitee)
- Open an Issue for bugs or feature requests.

---
Built with ❤️ by **Akash** using TypeScript & WebGL.

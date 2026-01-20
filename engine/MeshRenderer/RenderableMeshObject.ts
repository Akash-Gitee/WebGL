import { TextureCoordinates } from "../GeometryPrimitives/UVCoordinateMapper";
import { NormalsData } from "../GeometryPrimitives/SurfaceNormalCalculator";
import { Tangents } from "../GeometryPrimitives/TangentSpaceCalculator";
import { PBRMaterialProperties } from "../MaterialSystem/PBRMaterialProperties";
import { mat4, vec3 } from "../MathLibrary/gl-matrix";
import { uuidv4 } from "../IdentifierSystem/UniqueIdentifierGenerator";

type Vec3 = [number, number, number];
type Quaternion = [number, number, number, number];

interface MeshData {
  id?: string | number;
  translation?: Vec3;
  rotation?: Quaternion;
  scale?: Vec3;
  nodeIndex?: number;
}

interface BoundingBox {
  min: Vec3;
  max: Vec3;
}

export class RenderableMeshObject {
  geometry: any;
  vertices: Float32Array | number[];
  indices: Uint16Array | number[];
  type: string;
  uuid: string;
  texCoord: Float32Array | number[] | null;
  tangent: Float32Array | number[] | null;
  normals: Float32Array | number[] | null;
  material: PBRMaterialProperties;
  geometryNeedsUpdate: boolean = true;
  needsUpdate?: boolean;
  texture: WebGLTexture | null;
  normalMap: WebGLTexture | null;
  textureURL: string | null;
  normalMapURL: string | null;
  image: HTMLImageElement | null;
  normalMapImage: HTMLImageElement | null;
  highlightedFace?: number[]; // Add this line
  highlightColor?: [number, number, number]; // Optional
  modelMatrix: any;
  localMatrix: any;

  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotate: { x: number; y: number; z: number };

  parent: RenderableMeshObject | null;
  children: RenderableMeshObject[];
  nodeIndex: number | null;
  axis?: string;
  isGizmoPart?: boolean;
  visible: boolean = false;
  isSelected: boolean;
  originalBoundingBox?: BoundingBox;
  boundingBox?: BoundingBox;
  isRing?: boolean;
  hoveredFace?: number[];
  hoverColor?: [number, number, number];
  additionalTransform?: Float32Array;
  constructor(
    geometry: any,
    material?: PBRMaterialProperties | null,
    texture?:
      | WebGLTexture
      | null
      | { texture: WebGLTexture; textureUrl?: string },
    normalMap?:
      | WebGLTexture
      | null
      | { normalMap: WebGLTexture; normalMapUrl?: string },
    imageUri?: HTMLImageElement | null,
    normalMapUri?: HTMLImageElement | null,
    meshData: MeshData = {}
  ) {
    this.geometry = geometry;
    const { Vertices, Indices, type } = geometry;
    this.vertices = Vertices;
    this.indices = Indices;
    this.type = type;
    this.uuid = uuidv4();

    this.texCoord = geometry.TextureCoordinates ?? TextureCoordinates ?? null;
    this.tangent = geometry.Tangents ?? Tangents ?? null;
    this.normals = geometry.Normals ?? NormalsData ?? null;
    this.material = material ?? new PBRMaterialProperties();

    this.texture = (texture as any)?.texture ?? texture ?? null;
    this.normalMap = (normalMap as any)?.normalMap ?? normalMap ?? null;
    // Handle both textureUrl and textureURL property names
    this.textureURL = (texture as any)?.textureUrl ?? (texture as any)?.textureURL ?? null;
    this.normalMapURL = (normalMap as any)?.normalMapUrl ?? (normalMap as any)?.normalMapURL ?? null;
    this.image = imageUri ?? null;
    this.normalMapImage = normalMapUri ?? null;
    this.isSelected = false;
    this.modelMatrix = mat4.create();
    this.localMatrix = mat4.create();
    this.position = meshData.translation
      ? {
        x: meshData.translation[0],
        y: meshData.translation[1],
        z: meshData.translation[2],
      }
      : { x: 0, y: 0, z: 0 };
    this.scale = meshData.scale
      ? { x: meshData.scale[0], y: meshData.scale[1], z: meshData.scale[2] }
      : { x: 1, y: 1, z: 1 };
    this.rotate = meshData.rotation
      ? this.quaternionToEuler(meshData.rotation)
      : { x: 0, y: 0, z: 0 };
    this.parent = null;
    this.children = [];
    this.nodeIndex = meshData.nodeIndex || null;
    this.updateLocalMatrix();
  }
  quaternionToEuler(quaternion: Quaternion): {
    x: number;
    y: number;
    z: number;
  } {
    const [x, y, z, w] = quaternion;
    return {
      x: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
      y: Math.asin(2 * (w * y - z * x)),
      z: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)),
    };
  }
  setParent(parent: RenderableMeshObject) {
    if (parent instanceof RenderableMeshObject) {
      if (this.parent) {
        const index = this.parent.children.indexOf(this);
        if (index !== -1) {
          this.parent.children.splice(index, 1);
        }
      }
      this.parent = parent;
      if (!parent.children.includes(this)) {
        parent.children.push(this);
      }
    } else {
      console.error("Parent must be an instance of RenderableMeshObject.");
    }
  }
  getWorldMatrix(): any {
    if (this.parent) {
      const parentMatrix = this.parent.getWorldMatrix();
      mat4.multiply(this.modelMatrix, parentMatrix, this.localMatrix);
    } else {
      mat4.copy(this.modelMatrix, this.localMatrix);
    }
    return this.modelMatrix;
  }
  updateLocalMatrix(): void {
    // Create fresh matrix
    this.localMatrix = mat4.create();
    mat4.identity(this.localMatrix);
    // Apply transformations in TRS order (Translate -> Rotate -> Scale)
    mat4.translate(this.localMatrix, this.localMatrix, [
      this.position.x,
      this.position.y,
      this.position.z,
    ]);

    mat4.rotateX(this.localMatrix, this.localMatrix, this.rotate.x);
    mat4.rotateY(this.localMatrix, this.localMatrix, this.rotate.y);
    mat4.rotateZ(this.localMatrix, this.localMatrix, this.rotate.z);

    mat4.scale(this.localMatrix, this.localMatrix, [
      this.scale.x,
      this.scale.y,
      this.scale.z,
    ]);

    // Update world matrix and bounding box
    this.getWorldMatrix();
    this.updateBoundingBox();
  }
  updateChildren(): void {
    this.children.forEach((child) => {
      child.getWorldMatrix();
      child.updateBoundingBox();
      child.updateChildren();
    });
  }
  updateTranslate(deltaX = 0, deltaY = 0, deltaZ = 0): void {
    this.position.x += deltaX;
    this.position.y += deltaY;
    this.position.z += deltaZ;
    this.updateLocalMatrix();
    this.updateChildren();
  }
  updateScale(
    scaleX: number | null = null,
    scaleY: number | null = null,
    scaleZ: number | null = null
  ): void {
    if (scaleX !== null) this.scale.x = scaleX;
    if (scaleY !== null) this.scale.y = scaleY;
    if (scaleZ !== null) this.scale.z = scaleZ;
    this.updateLocalMatrix();
  }
  ObjectRotation(): void {
    this.updateLocalMatrix();
  }
  updateBoundingBox(): void {
    if (!this.geometry || !this.geometry.Vertices) return;
    const worldMatrix = this.getWorldMatrix();
    const vertexCount = this.geometry.Vertices.length / 3;
    if (vertexCount === 0) return;
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];

    const worldVertex = vec3.create();
    const vertex = vec3.create();

    // Process all vertices
    for (let i = 0; i < vertexCount; i++) {
      vertex[0] = this.geometry.Vertices[i * 3];
      vertex[1] = this.geometry.Vertices[i * 3 + 1];
      vertex[2] = this.geometry.Vertices[i * 3 + 2];

      // Skip invalid vertices
      if (!isFinite(vertex[0]) || !isFinite(vertex[1]) || !isFinite(vertex[2])) continue;

      vec3.transformMat4(worldVertex, vertex, worldMatrix);

      // Update min/max bounds
      for (let j = 0; j < 3; j++) {
        if (isFinite(worldVertex[j])) {
          min[j] = Math.min(min[j], worldVertex[j]);
          max[j] = Math.max(max[j], worldVertex[j]);
        }
      }
    }

    // Ensure valid bounding box
    for (let i = 0; i < 3; i++) {
      if (!isFinite(min[i])) min[i] = 0;
      if (!isFinite(max[i])) max[i] = 0;

      // Prevent zero-size bounding box
      if (Math.abs(max[i] - min[i]) < 0.001) {
        const center = (min[i] + max[i]) * 0.5;
        min[i] = center - 0.001;
        max[i] = center + 0.001;
      }
    }

    this.boundingBox = { min, max };
  }
}

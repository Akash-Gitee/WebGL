import { mat4 } from "../MathLibrary/gl-matrix.js";
import { uuidv4 } from "../IdentifierSystem/UniqueIdentifierGenerator.js";

export class SphereGeometryBuilder {
  uuid: string;
  type: string;
  modelMatrix: any;

  constructor() {
    this.uuid = uuidv4();
    this.type = "Sphere-Geometry";
    this.modelMatrix = mat4.create();
  }

  SphereData(
    radius: number = 1,
    rings: number = 16,
    segments: number = 22
  ): {
    type: string;
    Vertices: number[];
    Indices: number[];
    Normals: number[];
    Tangents: number[];
    TextureCoordinates: number[];
  } {
    const Vertices: number[] = [];
    const Normals: number[] = [];
    const Tangents: number[] = [];
    const TextureCoordinates: number[] = [];
    const Indices: number[] = [];

    for (let y = 0; y <= rings; y++) {
      const v = y / rings;
      const theta = v * Math.PI;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      for (let x = 0; x <= segments; x++) {
        const u = x / segments;
        const phi = u * 2 * Math.PI;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        const posX = radius * sinTheta * cosPhi;
        const posY = radius * cosTheta;
        const posZ = radius * sinTheta * sinPhi;

        const normalX = sinTheta * cosPhi;
        const normalY = cosTheta;
        const normalZ = sinTheta * sinPhi;

        const tangentX = -sinPhi;
        const tangentY = 0;
        const tangentZ = cosPhi;
        const tangentW = 1.0;

        Vertices.push(posX, posY, posZ);
        Normals.push(normalX, normalY, normalZ);
        TextureCoordinates.push(u, v);
        Tangents.push(tangentX, tangentY, tangentZ, tangentW);
      }
    }

    for (let y = 0; y < rings; y++) {
      for (let x = 0; x < segments; x++) {
        const i1 = y * (segments + 1) + x;
        const i2 = i1 + segments + 1;
        const i3 = i1 + 1;
        const i4 = i2 + 1;

        // Ensure counter-clockwise winding order
        Indices.push(i1, i3, i2);
        Indices.push(i3, i4, i2);
      }
    }

    return { type: this.type, Vertices, Indices, Normals, Tangents, TextureCoordinates };
  }
}
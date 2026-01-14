import { mat4 } from "../MathLibrary/gl-matrix.js";
import { uuidv4 } from "../IdentifierSystem/UniqueIdentifierGenerator.js";

export class PlaneGeometryBuilder {
  uuid: string;
  type: string;
  modelMatrix: any;
  constructor() {
    this.uuid = uuidv4();
    this.type = "Plane-Geometry";
    this.modelMatrix = mat4.create();
  }

  PlaneData(): { type: string; Vertices: number[]; Indices: number[] } {
    const Vertices = [
      -2.0,
      0.0,
      2.0, // Vertex 0
      2.0,
      0.0,
      2.0, // Vertex 1
      2.0,
      0.0,
      -2.0, // Vertex 2
      -2.0,
      0.0,
      -2.0, // Vertex 3
    ];

    const Indices = [
      0,
      1,
      2, // First Triangle
      2,
      3,
      0, // Second Triangle
    ];

    return { type: this.type, Vertices, Indices };
  }
}

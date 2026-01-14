import { mat4 } from "../MathLibrary/gl-matrix.js";
import { uuidv4 } from "../IdentifierSystem/UniqueIdentifierGenerator.js";

export class BoxGeometryBuilder {
  uuid: string;
  type: string;
  Vertices: number[];
  Indices: number[];
  modelMatrix: any;

  constructor() {
    this.uuid = uuidv4();
    this.type = "Cube-Geometry";
    this.Vertices = [];
    this.Indices = [];
    this.modelMatrix = mat4.create();
  }

  CubeData() {
    let Vertices: number[] = [
      // Front face
      -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,

      // Back face
      -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0,

      // Top face
      -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0,

      // Bottom face
      1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0,

      // Right face
      1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0,

      // Left face
      -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
    ];

    let Indices: number[] = [
      // Front face (flipped)
      0, 1, 2, 0, 2, 3,
      // Back face (flipped)
      4, 5, 6, 4, 6, 7,
      // Top face
      8, 9, 10, 8, 10, 11,
      // Bottom face
      12, 13, 14, 12, 14, 15,
      // Right face
      16, 17, 18, 16, 18, 19,
      // Left face
      20, 22, 23, 20, 21, 22,
    ];

    return { type: this.type, Vertices, Indices };
  }
}

// import { Matrix4Operations } from "../../src/Math/mathlib.js";
// import { uuidv4 } from "../../src/UUID/UUID.js";

// export class CylinderGeometry {
//   Vertices: number[];
//   Indices: number[];
//   uuid: string;
//   type: string;
//   radius: number;
//   height: number;
//   segments: number;
//   modelMatrix: number[];

//   constructor(radius: number = 1, height: number = 2, segments: number = 32) {
//     this.uuid = uuidv4();
//     this.Vertices = [];
//     this.Indices = [];
//     this.radius = radius;
//     this.type = "Cylinder-Geometry";
//     this.height = height;
//     this.segments = segments;
//     this.modelMatrix = Matrix4Operations.create();

//     const cylinderData = this.CylinderData(this.radius, this.height, this.segments);
//     this.Vertices = cylinderData.Vertices;
//     this.Indices = cylinderData.Indices;
//   }

//   CylinderData(
//     radius: number = 1,
//     height: number = 2,
//     segments: number = 32
//   ): {
//     type: string;
//     Vertices: number[];
//     Indices: number[];
//     Normals: number[];
//     Tangents: number[];
//     TextureCoordinates: number[];
//   } {
//     const Vertices: number[] = [];
//     const Normals: number[] = [];
//     const Tangents: number[] = [];
//     const TextureCoordinates: number[] = [];
//     const Indices: number[] = [];

//     // TOP FACE - Single quad (4 vertices)
//     const topY = height / 2;
//     Vertices.push(-radius, topY, -radius); // 0: Top-left
//     Normals.push(0, 1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(0, 0);

//     Vertices.push(radius, topY, -radius);  // 1: Top-right
//     Normals.push(0, 1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(1, 0);

//     Vertices.push(radius, topY, radius);   // 2: Bottom-right
//     Normals.push(0, 1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(1, 1);

//     Vertices.push(-radius, topY, radius); // 3: Bottom-left
//     Normals.push(0, 1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(0, 1);

//     // BOTTOM FACE - Single quad (4 vertices)
//     const bottomY = -height / 2;
//     Vertices.push(-radius, bottomY, -radius); // 4: Top-left
//     Normals.push(0, -1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(0, 0);

//     Vertices.push(-radius, bottomY, radius);  // 5: Bottom-left
//     Normals.push(0, -1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(0, 1);

//     Vertices.push(radius, bottomY, radius);   // 6: Bottom-right
//     Normals.push(0, -1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(1, 1);

//     Vertices.push(radius, bottomY, -radius); // 7: Top-right
//     Normals.push(0, -1, 0);
//     Tangents.push(1, 0, 0);
//     TextureCoordinates.push(1, 0);

//     // TOP FACE INDICES - Single quad as 2 triangles
//     Indices.push(0, 1, 2); // First triangle
//     Indices.push(0, 2, 3); // Second triangle

//     // BOTTOM FACE INDICES - Single quad as 2 triangles
//     Indices.push(4, 5, 6); // First triangle
//     Indices.push(4, 6, 7); // Second triangle

//     // SIDE FACES - Connect the quad edges
//     // Front face (Z = -radius)
//     Indices.push(0, 4, 7); // Triangle 1
//     Indices.push(0, 7, 1); // Triangle 2

//     // Right face (X = radius)
//     Indices.push(1, 7, 6); // Triangle 1
//     Indices.push(1, 6, 2); // Triangle 2

//     // Back face (Z = radius)
//     Indices.push(2, 6, 5); // Triangle 1
//     Indices.push(2, 5, 3); // Triangle 2

//     // Left face (X = -radius)
//     Indices.push(3, 5, 4); // Triangle 1
//     Indices.push(3, 4, 0); // Triangle 2

//     return {
//       type: this.type,
//       Vertices,
//       Indices,
//       Normals,
//       Tangents,
//       TextureCoordinates
//     };
//   }
// }

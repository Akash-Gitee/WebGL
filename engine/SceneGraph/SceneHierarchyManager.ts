import { GridHelper } from "../CoreUtilities/GridHelper.js";
import { RenderableMeshObject } from "../MeshRenderer/RenderableMeshObject.js";
import { SceneLightingManager } from "../LightingEngine/SceneLightingManager.js";
export class SceneHierarchyManager {
  objects: RenderableMeshObject[];
  lights: SceneLightingManager[];
  grids: GridHelper[];

  constructor() {
    this.objects = [];
    this.lights = [];
    this.grids = [];
  }

  add(object: RenderableMeshObject | GridHelper | SceneLightingManager): void {
    if (object instanceof RenderableMeshObject) {
      this.objects.push(object);
    } else if (object instanceof GridHelper) {
      this.grids.push(object);
    } else if (object instanceof SceneLightingManager) {
      this.lights.push(object);
    }
  }
}

import { GridHelper } from "../CoreUtilities/GridHelper";
import { RenderableMeshObject } from "../MeshRenderer/RenderableMeshObject";
import { SceneLightingManager } from "../LightingEngine/SceneLightingManager";
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

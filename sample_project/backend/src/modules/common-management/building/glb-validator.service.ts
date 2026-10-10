import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GLB Validation result returned to the frontend.
 */
export interface GlbFloorInfo {
  name: string;
  floorNumber: number;
  floorType: 'BASEMENT' | 'GROUND' | 'OFFICE' | 'COMMERCIAL' | 'MECHANICAL' | 'ROOFTOP' | 'PARKING';
  heightM: number;
  widthM: number;
  depthM: number;
}

export interface GlbValidationResult {
  valid: boolean;
  floors: GlbFloorInfo[];
  warnings: string[];
  errors: string[];
  totalNodes: number;
  fileSizeMB: number;
}

// ── Floor name parsing helpers ──────────────────────────────────────────

/** Convention: floor_B1, floor_G, floor_F01, floor_R (+ legacy tang_*) */
const FLOOR_REGEX = /^(floor|tang)_(B\d+|G|F\d{1,2}|R)$/i;

function isFloorName(name: string): boolean {
  return FLOOR_REGEX.test(name.trim());
}

function parseFloorNumber(name: string): number {
  const m = name.match(/_(B(\d+)|G|F(\d{1,2})|R)$/i);
  if (!m) return 0;
  const tag = m[1].toUpperCase();
  if (tag.startsWith('B')) return -parseInt(m[2], 10); // B1 → -1, B2 → -2
  if (tag === 'G') return 0;
  if (tag === 'R') return 999; // Will be re-assigned after sorting
  if (tag.startsWith('F')) return parseInt(m[3], 10);
  return 0;
}

function detectFloorType(name: string): GlbFloorInfo['floorType'] {
  const tag = name.match(/_(B\d+|G|F\d{1,2}|R)$/i)?.[1]?.toUpperCase() || '';
  if (tag.startsWith('B')) return 'BASEMENT';
  if (tag === 'G') return 'GROUND';
  if (tag === 'R') return 'ROOFTOP';
  return 'OFFICE';
}

// ── Minimal GLB binary parser ───────────────────────────────────────────
// GLB is a binary container: 12-byte header + JSON chunk + BIN chunk.
// We only need the JSON chunk to read the node tree and accessor metadata.
// No need for heavy deps like @gltf-transform when we just parse structure.

interface GltfNode {
  name?: string;
  children?: number[];
  mesh?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

interface GltfScene {
  name?: string;
  nodes?: number[];
}

interface GltfAccessor {
  min?: number[];
  max?: number[];
}

interface GltfMesh {
  name?: string;
  primitives?: { attributes?: Record<string, number> }[];
}

interface GltfJson {
  scenes?: GltfScene[];
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  scene?: number;
}

function parseGlbJson(buffer: Buffer): GltfJson {
  // GLB header: magic(4) + version(4) + length(4) = 12 bytes
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) {
    throw new Error('Invalid GLB: bad magic number');
  }

  // Chunk 0: JSON
  const chunk0Length = buffer.readUInt32LE(12);
  const chunk0Type = buffer.readUInt32LE(16);
  if (chunk0Type !== 0x4E4F534A) {
    throw new Error('Invalid GLB: first chunk is not JSON');
  }

  const jsonStr = buffer.slice(20, 20 + chunk0Length).toString('utf-8');
  return JSON.parse(jsonStr);
}

// ── BoundingBox estimation from node subtree ────────────────────────────
// Without loading actual geometry, we estimate floor dimensions from mesh
// accessor min/max bounds (POSITION attribute). This is approximate but
// sufficient for validation purposes.

interface BBox {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

function getNodeBBox(
  nodeIndex: number,
  gltf: GltfJson,
  visited = new Set<number>(),
): BBox | null {
  if (visited.has(nodeIndex)) return null;
  visited.add(nodeIndex);

  const nodes = gltf.nodes || [];
  const meshes = gltf.meshes || [];
  const accessors = gltf.accessors || [];
  const node = nodes[nodeIndex];
  if (!node) return null;

  let result: BBox | null = null;

  const merge = (b: BBox) => {
    if (!result) {
      result = { ...b };
    } else {
      result.minX = Math.min(result.minX, b.minX);
      result.maxX = Math.max(result.maxX, b.maxX);
      result.minY = Math.min(result.minY, b.minY);
      result.maxY = Math.max(result.maxY, b.maxY);
      result.minZ = Math.min(result.minZ, b.minZ);
      result.maxZ = Math.max(result.maxZ, b.maxZ);
    }
  };

  // Mesh bounds
  if (node.mesh !== undefined) {
    const mesh = meshes[node.mesh];
    if (mesh?.primitives) {
      for (const prim of mesh.primitives) {
        const posIdx = prim.attributes?.POSITION;
        if (posIdx !== undefined) {
          const acc = accessors[posIdx];
          if (acc?.min && acc?.max && acc.min.length >= 3 && acc.max.length >= 3) {
            merge({
              minX: acc.min[0], maxX: acc.max[0],
              minY: acc.min[1], maxY: acc.max[1],
              minZ: acc.min[2], maxZ: acc.max[2],
            });
          }
        }
      }
    }
  }

  // Children
  if (node.children) {
    for (const childIdx of node.children) {
      const childBox = getNodeBBox(childIdx, gltf, visited);
      if (childBox) merge(childBox);
    }
  }

  return result;
}

function hasGeometry(nodeIndex: number, gltf: GltfJson, visited = new Set<number>()): boolean {
  if (visited.has(nodeIndex)) return false;
  visited.add(nodeIndex);
  const node = (gltf.nodes || [])[nodeIndex];
  if (!node) return false;
  if (node.mesh !== undefined) return true;
  if (node.children) {
    for (const c of node.children) {
      if (hasGeometry(c, gltf, visited)) return true;
    }
  }
  return false;
}

// ── Main validator ──────────────────────────────────────────────────────

@Injectable()
export class GlbValidatorService {
  private readonly logger = new Logger(GlbValidatorService.name);

  /**
   * Validate a GLB file and extract floor structure.
   * @param filePath Absolute path to the .glb file
   * @returns Validation result with floors, warnings, errors
   */
  async validate(filePath: string): Promise<GlbValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const floors: GlbFloorInfo[] = [];

    // ── File checks ───────────────────────────────────────────────────
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.glb') {
      return { valid: false, floors: [], warnings: [], errors: ['File must be in .glb format'], totalNodes: 0, fileSizeMB: 0 };
    }

    const stat = fs.statSync(filePath);
    const fileSizeMB = +(stat.size / (1024 * 1024)).toFixed(2);
    if (fileSizeMB > 50) {
      return { valid: false, floors: [], warnings: [], errors: [`File too large (max 50MB). Current: ${fileSizeMB}MB`], totalNodes: 0, fileSizeMB };
    }

    // ── Parse GLB JSON ────────────────────────────────────────────────
    let gltf: GltfJson;
    try {
      const buffer = fs.readFileSync(filePath);
      gltf = parseGlbJson(buffer);
    } catch (e: any) {
      return { valid: false, floors: [], warnings: [], errors: [`Invalid GLB file: ${e.message}`], totalNodes: 0, fileSizeMB };
    }

    const nodes = gltf.nodes || [];
    const totalNodes = nodes.length;

    // ── Find floor groups ─────────────────────────────────────────────
    // Strategy: look at scene root nodes and their direct children (for Blender "Scene" wrapper)
    const sceneIdx = gltf.scene ?? 0;
    const scene = (gltf.scenes || [])[sceneIdx];
    if (!scene || !scene.nodes) {
      return { valid: false, floors: [], warnings: [], errors: ['GLB has no scene'], totalNodes, fileSizeMB };
    }

    // Collect candidate node indices (level 1 + level 2)
    const candidateIndices: number[] = [];
    for (const rootIdx of scene.nodes) {
      const rootNode = nodes[rootIdx];
      if (!rootNode) continue;

      if (rootNode.name && isFloorName(rootNode.name)) {
        candidateIndices.push(rootIdx);
      } else {
        // Check children (Blender "Scene" wrapper case)
        if (rootNode.children) {
          for (const childIdx of rootNode.children) {
            const child = nodes[childIdx];
            if (child?.name && isFloorName(child.name)) {
              candidateIndices.push(childIdx);
            }
          }
        }
      }
    }

    // Fallback: if no convention names found, try ALL nodes with floor-ish names
    if (candidateIndices.length === 0) {
      const allNames: string[] = [];
      nodes.forEach((n, i) => {
        if (n.name) allNames.push(n.name);
        if (n.name && isFloorName(n.name)) candidateIndices.push(i);
      });

      if (candidateIndices.length === 0) {
        errors.push(
          `No floors detected. Found objects: [${allNames.slice(0, 20).join(', ')}${allNames.length > 20 ? '...' : ''}]. ` +
          `Name floors as: floor_B1, floor_G, floor_F01, floor_R (see docs/GLB_SPECIFICATION.md)`,
        );
        return { valid: false, floors: [], warnings, errors, totalNodes, fileSizeMB };
      }
    }

    // ── Validate each floor ───────────────────────────────────────────
    for (const idx of candidateIndices) {
      const node = nodes[idx];
      const name = node.name || `node_${idx}`;

      // Check geometry
      if (!hasGeometry(idx, gltf)) {
        errors.push(`Floor "${name}" is empty — no mesh geometry found`);
        continue;
      }

      // Check naming convention
      if (!FLOOR_REGEX.test(name)) {
        warnings.push(`Floor "${name}" doesn't follow naming convention (floor_B/G/F/R). Auto-detected.`);
      }

      // BoundingBox
      const bbox = getNodeBBox(idx, gltf);
      const heightM = bbox ? +(bbox.maxY - bbox.minY).toFixed(2) : 0;
      const widthM = bbox ? +(bbox.maxX - bbox.minX).toFixed(2) : 0;
      const depthM = bbox ? +(bbox.maxZ - bbox.minZ).toFixed(2) : 0;

      if (heightM > 0 && heightM < 2.0) {
        warnings.push(`Floor "${name}" height is ${heightM}m — too low (recommended ≥ 2m)`);
      }
      if (widthM > 0 && widthM < 5.0) {
        warnings.push(`Floor "${name}" plan size ${widthM}×${depthM}m — too small`);
      }

      floors.push({
        name,
        floorNumber: parseFloorNumber(name),
        floorType: detectFloorType(name),
        heightM,
        widthM,
        depthM,
      });
    }

    // Sort floors by floorNumber
    floors.sort((a, b) => a.floorNumber - b.floorNumber);

    // Fix rooftop floorNumber (replace 999 with max+1)
    const maxFn = Math.max(0, ...floors.filter(f => f.floorNumber < 999).map(f => f.floorNumber));
    floors.forEach(f => {
      if (f.floorNumber === 999) f.floorNumber = maxFn + 1;
    });

    // Check overlap between adjacent floors
    // (would need Y positions, skip for now — add warning if bboxes available)

    const valid = errors.length === 0 && floors.length > 0;

    this.logger.log(
      `GLB validation: ${valid ? '✅' : '❌'} — ${floors.length} floors, ${errors.length} errors, ${warnings.length} warnings`,
    );

    return { valid, floors, warnings, errors, totalNodes, fileSizeMB };
  }
}

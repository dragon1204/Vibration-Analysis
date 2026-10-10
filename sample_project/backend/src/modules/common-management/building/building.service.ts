import { Injectable, Logger } from '@nestjs/common';
import { CNotFoundException } from '@shared/custom-http-exception';
import { generateSlug } from '@shared/utils/slug.util';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateBuildingDto, UpdateBuildingDto } from './dto/building.dto';
import { GlbValidatorService, GlbValidationResult } from './glb-validator.service';
import * as fs from 'fs';
import * as path from 'path';

/** Directory where GLB model files are stored (frontend static assets) */
const MODELS_DIR = path.resolve(__dirname, '../../../../..', 'frontend/public/models');

@Injectable()
export class BuildingService {
  private readonly logger = new Logger(BuildingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly glbValidator: GlbValidatorService,
  ) {}

  async findAll(urbanId?: number) {
    return this.prisma.building.findMany({
      where: urbanId ? { urbanId } : {},
      include: {
        urban: { select: { id: true, name: true, slug: true } },
        _count: { select: { floors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: {
        urban: { select: { id: true, name: true, slug: true } },
        floors: {
          orderBy: { floorNumber: 'asc' },
          include: {
            _count: { select: { devices: true } },
          },
        },
      },
    });

    if (!building) {
      throw new CNotFoundException(BuildingService.name, 'Building not found');
    }

    return building;
  }

  /**
   * Find a building by urban slug + building slug.
   * Used by the frontend to resolve URL params like /:urbanSlug/:buildingSlug.
   */
  async findBySlug(urbanSlug: string, buildingSlug: string) {
    const urban = await this.prisma.urban.findUnique({
      where: { slug: urbanSlug },
    });

    if (!urban) {
      throw new CNotFoundException(BuildingService.name, 'Urban not found');
    }

    const building = await this.prisma.building.findFirst({
      where: {
        urbanId: urban.id,
        slug: buildingSlug,
      },
      include: {
        urban: { select: { id: true, name: true, slug: true, latitude: true, longitude: true, address: true } },
        floors: {
          orderBy: { floorNumber: 'asc' },
          include: {
            _count: { select: { devices: true } },
          },
        },
      },
    });

    if (!building) {
      throw new CNotFoundException(BuildingService.name, 'Building not found');
    }

    return building;
  }

  /**
   * Create a building with optional GLB file upload.
   * If a GLB file is provided:
   *   1. Validate structure (naming, geometry, dimensions)
   *   2. Create building record
   *   3. Save file as <buildingId>.glb
   *   4. Auto-create Floor records from parsed floor groups
   */
  async create(data: CreateBuildingDto, modelFile?: Express.Multer.File) {
    // Auto-generate slug from name
    const slug = generateSlug(data.name);

    // Ensure slug uniqueness within the same urban
    let finalSlug = slug;
    let counter = 1;
    while (
      await this.prisma.building.findFirst({
        where: { urbanId: data.urbanId, slug: finalSlug },
      })
    ) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    // ── If GLB file provided: validate first ──────────────────────
    let validation: GlbValidationResult | null = null;
    let tempPath: string | null = null;

    if (modelFile) {
      // Write to temp location for validation
      tempPath = path.join(MODELS_DIR, `_temp_${Date.now()}.glb`);
      fs.mkdirSync(MODELS_DIR, { recursive: true });
      fs.writeFileSync(tempPath, modelFile.buffer);

      validation = await this.glbValidator.validate(tempPath);

      if (!validation.valid) {
        // Clean up temp file
        fs.unlinkSync(tempPath);
        return {
          building: null,
          validation,
          message: 'GLB validation failed. Building was NOT created.',
        };
      }
    }

    // ── Create building record ────────────────────────────────────
    const building = await this.prisma.building.create({
      data: {
        ...data,
        slug: finalSlug,
        totalFloors: validation ? validation.floors.length : (data.totalFloors || 1),
        modelUrl: `/models/${finalSlug}.glb`, // Will be updated to <id>.glb after creation
      } as any,
    });

    // ── Save GLB file as <buildingId>.glb ─────────────────────────
    if (tempPath && validation) {
      const finalPath = path.join(MODELS_DIR, `${building.id}.glb`);
      fs.renameSync(tempPath, finalPath);
      this.logger.log(`GLB saved: ${finalPath} (${validation.fileSizeMB} MB)`);

      // Update modelUrl with actual ID
      await this.prisma.building.update({
        where: { id: building.id },
        data: { modelUrl: `/models/${building.id}.glb` },
      });

      // ── Auto-create Floor records ────────────────────────────────
      const floorRecords = validation.floors.map(f => ({
        buildingId: building.id,
        floorNumber: f.floorNumber,
        name: f.name,
        floorType: f.floorType as any,
        height: f.heightM || 3.5,
        elevation: 0,
      }));

      if (floorRecords.length > 0) {
        await this.prisma.floor.createMany({ data: floorRecords });
        this.logger.log(`Auto-created ${floorRecords.length} floors for building ${building.id}`);
      }
    }

    // ── Return result ─────────────────────────────────────────────
    const fullBuilding = await this.findOne(building.id);
    return {
      building: fullBuilding,
      validation: validation || undefined,
      message: validation
        ? `Building created with ${validation.floors.length} floors auto-detected from GLB.`
        : 'Building created (no 3D model uploaded).',
    };
  }

  async update(id: number, data: UpdateBuildingDto) {
    await this.findOne(id);
    return this.prisma.building.update({ where: { id }, data });
  }

  async delete(id: number) {
    await this.findOne(id);

    // Also delete the GLB file if it exists
    const filePath = path.join(MODELS_DIR, `${id}.glb`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`Deleted GLB file: ${filePath}`);
    }

    return this.prisma.building.delete({ where: { id } });
  }
}

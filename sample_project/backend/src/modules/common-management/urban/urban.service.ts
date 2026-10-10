import { Injectable } from '@nestjs/common';
import { CNotFoundException } from '@shared/custom-http-exception';
import { generateSlug } from '@shared/utils/slug.util';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateUrbanDto, UpdateUrbanDto } from './dto/urban.dto';

@Injectable()
export class UrbanService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.urban.findMany({
      include: {
        buildings: {
          select: {
            id: true,
            name: true,
            code: true,
            slug: true,
            totalFloors: true,
            _count: { select: { floors: true } },
          },
        },
        _count: { select: { buildings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const urban = await this.prisma.urban.findUnique({
      where: { id },
      include: {
        buildings: {
          include: {
            floors: {
              orderBy: { floorNumber: 'asc' },
              select: {
                id: true,
                floorNumber: true,
                name: true,
                floorType: true,
                _count: { select: { devices: true } },
              },
            },
            _count: { select: { floors: true } },
          },
        },
      },
    });

    if (!urban) {
      throw new CNotFoundException(UrbanService.name, 'Urban not found');
    }

    return urban;
  }

  /**
   * Find an urban by its slug (URL-friendly identifier).
   * Includes building list for the frontend BuildingLayout.
   */
  async findBySlug(slug: string) {
    const urban = await this.prisma.urban.findUnique({
      where: { slug },
      include: {
        buildings: {
          select: {
            id: true,
            name: true,
            code: true,
            slug: true,
            totalFloors: true,
            _count: { select: { floors: true } },
          },
        },
        _count: { select: { buildings: true } },
      },
    });

    if (!urban) {
      throw new CNotFoundException(UrbanService.name, 'Urban not found');
    }

    return urban;
  }

  async create(data: CreateUrbanDto) {
    // Auto-generate slug from name
    const slug = generateSlug(data.name);

    // Ensure slug uniqueness by appending a counter if needed
    let finalSlug = slug;
    let counter = 1;
    while (await this.prisma.urban.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    return this.prisma.urban.create({
      data: { ...data, slug: finalSlug } as any,
    });
  }

  async update(id: number, data: UpdateUrbanDto) {
    await this.findOne(id);
    return this.prisma.urban.update({ where: { id }, data });
  }

  async delete(id: number) {
    await this.findOne(id);
    return this.prisma.urban.delete({ where: { id } });
  }
}

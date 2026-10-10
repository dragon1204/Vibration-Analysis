import { Injectable } from '@nestjs/common';
import { CNotFoundException } from '@shared/custom-http-exception';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateFloorDto, UpdateFloorDto } from './dto/floor.dto';

@Injectable()
export class FloorService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(buildingId?: number) {
    return this.prisma.floor.findMany({
      where: buildingId ? { buildingId } : {},
      include: {
        _count: { select: { devices: true } },
      },
      orderBy: { floorNumber: 'asc' },
    });
  }

  async findOne(id: number) {
    const floor = await this.prisma.floor.findUnique({
      where: { id },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            urbanId: true,
            urban: { select: { id: true, name: true } },
          },
        },
        devices: {
          orderBy: { type: 'asc' },
        },
      },
    });

    if (!floor) {
      throw new CNotFoundException(FloorService.name, 'Floor not found');
    }

    return floor;
  }

  async create(data: CreateFloorDto) {
    return this.prisma.floor.create({ data });
  }

  async update(id: number, data: UpdateFloorDto) {
    await this.findOne(id);
    return this.prisma.floor.update({ where: { id }, data });
  }

  async delete(id: number) {
    await this.findOne(id);
    return this.prisma.floor.delete({ where: { id } });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CBadRequestException,
  CNotFoundException,
} from '@shared/custom-http-exception';

import { BQueryParams } from '../dto/base.dto';

@Injectable()
export class BaseService<T> {
  constructor(protected model: any) { }

  async findAll() {
    return await this.model.findMany({
      where: { isDeleted: false }
    });
  }

  async pagination(
    query: BQueryParams,
    relationFilter?: { field: string; value: any },
  ) {
    const {
      page,
      limit = 10,
      sortBy,
      order = 'desc',
      search,
      searchFields = [],
    } = query;

    if (!page) {
      throw new CBadRequestException('BaseService', 'Page is required');
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (isNaN(pageNumber) || isNaN(limitNumber)) {
      throw new CBadRequestException('BaseService', 'Page and limit must be numbers');
    }

    const skip = (pageNumber - 1) * limitNumber;
    const take = limitNumber;

    const orderBy = sortBy ? { [sortBy]: order } : undefined;
    let where: any = { isDeleted: false };

    if (
      relationFilter &&
      relationFilter.field &&
      relationFilter.value !== undefined
    ) {
      where[relationFilter.field] = relationFilter.value;
    }

    if (search && searchFields.length > 0) {
      where = {
        ...where,
        OR: searchFields.map((field) => ({
          [field]: { contains: search, mode: 'insensitive' },
        })),
      };
    }

    const [items, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.model.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    };
  }

  async paginationV2(
    query: BQueryParams,
    relationFilter?: { field: string; value: any },
  ) {
    const {
      page,
      limit = 10,
      sortBy,
      order = 'desc',
      search,
      searchFields = [],
    } = query;

    if (!page) {
      throw new CBadRequestException('BaseService', 'Page is required');
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (isNaN(pageNumber) || isNaN(limitNumber)) {
      throw new CBadRequestException('BaseService', 'Page and limit must be numbers');
    }

    const skip = (pageNumber - 1) * limitNumber;
    const take = limitNumber;

    const orderBy = sortBy ? { [sortBy]: order } : undefined;
    let where: any = { isDeleted: false };

    if (
      relationFilter &&
      relationFilter.field &&
      relationFilter.value !== undefined
    ) {
      where[relationFilter.field] = relationFilter.value;
    }

    if (search && searchFields.length > 0) {
      where = {
        ...where,
        OR: searchFields.map((field) => {
          const enumFields = ['type'];
          if (enumFields.includes(field)) {
            return { [field]: search.toUpperCase() };
          } else {
            return { [field]: { contains: search, mode: 'insensitive' } };
          }
        }),
      };
    }

    const [items, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      this.model.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    };
  }

  async find(key: string, value: any) {
    const where = {
      [key]: value,
      isDeleted: false
    };
    return await this.model.findMany({ where });
  }

  async findOne(key: string, value: any) {
    const where = {
      [key]: value,
      isDeleted: false
    };
    const result = await this.model.findFirst({ where });
    if (!result) {
      throw new CNotFoundException('BaseService', 'Not found');
    }
    return result;
  }

  async findById(id: number) {
    const className = this.constructor.name;
    
    if (isNaN(id) || id < 1) {
      throw new CBadRequestException('BaseService' ,className + ': ID must be a positive number');
    }
    const result = await this.model.findFirst({
      where: { id, isDeleted: false },
    });

    if (!result) {
      throw new CNotFoundException('BaseService' ,className + `: Not found id=${id}`);
    }

    return result;
  }

  async findByIds(ids: number[]) {
    if (
      !Array.isArray(ids) ||
      ids.some((id) => isNaN(Number(id)) || Number(id) < 1)
    ) {
      throw new CBadRequestException('BaseService', 'IDs must be an array of positive numbers');
    }

    const numericIds = ids.map((id) => Number(id));

    const result = await this.model.findMany({
      where: { id: { in: numericIds }, isDeleted: false },
    });

    if (!result) {
      throw new CNotFoundException('BaseService', `Not found ids=${ids}`);
    }

    return result;
  }

  async findByIdV2(id: number) {
    if (isNaN(id) || id < 1) {
      return null;
    }
    const result = await this.model.findFirst({
      where: { id, isDeleted: false },
    });

    if (!result) {
      return null;
    }

    return result;
  }

  async create(data: Partial<T>) {
    return await this.model.create({ data });
  }

  /**
   * Check if a record exists by id and is not soft-deleted.
   *
   * @param id - The unique identifier of the record
   * @throws NotFoundException if the record does not exist or has been soft-deleted
   * @returns The existing record
   */
  async checkExistById(id: any): Promise<T> {
    const existingRecord = await this.model.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existingRecord) {
      throw new NotFoundException(`Record with id ${id} not found`);
    }

    return existingRecord;
  }

  /**
   * Update a record by its unique id.
   *
   * @param id - The unique identifier of the record.
   * @param data - The partial data used to update the record.
   * @returns The updated record.
   */
  async update(id: any, data: Partial<T>) {
    await this.checkExistById(id);

    return await this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * Create a new record if it does not exist, or update it if it already exists.
   * Works based on the unique `id` field.
   */
  async upsert(id: any, data: Partial<T>) {
    return await this.model.upsert({
      where: { id },
      update: { ...data },
      create: { id, ...data },
    });
  }

  /**
   * Soft delete a record by its id.
   * Marks the record as deleted by setting `isDeleted` timestamp.
   *
   * @param id - The unique identifier of the record
   * @returns The updated record with isDeleted set
   */
  async softDelete(id: any): Promise<T> {
    await this.checkExistById(id);

    return this.model.update({
      where: { id },
      data: { isDeleted: true, deletionTime: new Date() },
    });
  }

  async updateById(id: number, data: Partial<T>) {
    if (isNaN(id) || id < 1) {
      throw new CBadRequestException('BaseService', 'ID must be a positive number');
    }
    // Check if entity exists before updating
    await this.findById(id);
    return await this.model.update({ where: { id }, data });
  }

  async deleteById(id: number) {
    if (isNaN(id) || id < 1) {
      throw new CBadRequestException('BaseService', 'ID must be a positive number');
    }
    await this.findById(id);
    return await this.model.delete({ where: { id } });
  }

  async deleteMany(ids: number[]) {
    if (!Array.isArray(ids) || ids.some((id) => isNaN(id) || id < 1)) {
      throw new CBadRequestException('BaseService', 'IDs must be an array of positive numbers');
    }
    return await this.model.deleteMany({ where: { id: { in: ids } } });
  }
}

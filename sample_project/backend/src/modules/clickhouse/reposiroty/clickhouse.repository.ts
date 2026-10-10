import { ClickHouseClient } from '@clickhouse/client';

import { inferType } from './parse-type.helper';

export abstract class BaseClickHouseRepository {
  constructor(
    protected readonly table: string,
    private readonly client: ClickHouseClient,
  ) {}
  async query(
    filter: Record<string, string | number | boolean | Date> = {},
    filterTime: {
      field?: string;
      fromDate?: string;
      toDate?: string;
    } = {
      field: 'createdAt',
      fromDate: new Date().toDateString(),
      toDate: new Date().toDateString(),
    },
    paging: { skip: number; take: number } = { skip: 0, take: 100 },
    order?: {
      field: 'createdAt' | 'id';
      by: 'ASC' | 'DESC';
    },
  ): Promise<any> {
    // 1. Khai báo câu truy vấn
    let sqlString = `SELECT * FROM ${this.table}`;
    const sqlParameters: Record<string, string | number | boolean | Date> = {}; // Định nghĩa parameter trong câu truy vấn

    // Ghép chuỗi biểu thức WHERE - Bộ lọc thời gian
    sqlString += ` WHERE`;
    const fromDate = new Date(filterTime.fromDate);
    const toDate = new Date(filterTime.toDate);
    console.log(fromDate, toDate);
    sqlString += ` ${filterTime.field} BETWEEN {fromDate:DateTime} AND {toDate:DateTime}`;
    sqlParameters['fromDate'] = fromDate;
    sqlParameters['toDate'] = toDate;

    // Ghép chuỗi biểu thức WHERE - Bộ lọc giá trị theo từng field
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'string') {
        sqlString += ` AND ${key} LIKE {${key}:${inferType(value)}}`;
        sqlParameters[key] = `%${value}%`;
      } else {
        sqlString += ` AND ${key} = {${key}:${inferType(value)}}`;
        sqlParameters[key] = value;
      }
    }

    // Sắp xếp theo id/createdAt
    if (order) sqlString += ` ORDER BY ${order.field} ${order.by}`;

    // Thực hiện phân trang
    if (paging) {
      sqlString += ` OFFSET {skip:Int64} LIMIT {take:Int64} `;
      sqlParameters['take'] = paging.take;
      sqlParameters['skip'] = paging.skip;
    }
    console.log('Câu truy vấn: ', sqlString);
    console.log('Params: ', sqlParameters);

    // Gọi truy vấn
    const result = await this.client.query({
      query: sqlString,
      query_params: sqlParameters,
      format: 'JSONEachRow',
    });

    const rows = await result.json();
    return rows;
  }

  async insert(data: Object | Object[]): Promise<boolean> {
    try {
      await this.client.insert({
        table: this.table,
        values: Array.isArray(data) ? data : [data],
        format: 'JSONEachRow',
      });
      console.log('Insert data successfully');
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }
}

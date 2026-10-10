import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';

const vietnameseTimeZone = () => {
  return new Date().toLocaleString('vn-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
};

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.splat(),
      winston.format.ms(),
      nestWinstonModuleUtilities.format.nestLike('NestApplication', {
        prettyPrint: true,
        colors: true,
      }),
    ),
  }),
];

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({
          format: vietnameseTimeZone,
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/info.log',
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: vietnameseTimeZone,
        }),
        winston.format.splat(),
        winston.format.json(),
        winston.format.ms(),
      ),
    }),
  );
}

export const CLogger = WinstonModule.createLogger({ transports });

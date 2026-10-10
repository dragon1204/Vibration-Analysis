import { SCOPE } from '@modules/building-device/enums/scope.enum';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace PrismaJson {
    type BuildingDeviceAttributes = {
      status?: number;
      webrtc?: string;
      snapshot?: string;
      hls?: string;
      jpeg?: string;
      auth?: string;
    };

    type BuildingDeviceConfiguration = {
      scope?: SCOPE;
    };
  }
}

export {};

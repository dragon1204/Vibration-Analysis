import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
@Injectable()
export class BuildingDeviceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BuildingDeviceGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client joins a building room to receive device updates for that building.
   * Usage from frontend: socket.emit('join:building', { buildingId: 1 })
   */
  @SubscribeMessage('join:building')
  handleJoinBuilding(client: Socket, payload: { buildingId: number }) {
    const room = `/building/${payload.buildingId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    client.emit('joined', { room });
  }

  /**
   * Client joins a specific floor room for more granular updates.
   * Usage from frontend: socket.emit('join:floor', { buildingId: 1, floorId: 5 })
   */
  @SubscribeMessage('join:floor')
  handleJoinFloor(client: Socket, payload: { buildingId: number; floorId: number }) {
    const room = `/building/${payload.buildingId}/floor/${payload.floorId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    client.emit('joined', { room });
  }

  /**
   * Client leaves a building room.
   */
  @SubscribeMessage('leave:building')
  handleLeaveBuilding(client: Socket, payload: { buildingId: number }) {
    const room = `/building/${payload.buildingId}`;
    client.leave(room);
  }

  /**
   * Broadcast device attribute update to all clients in the building room.
   * Called from BuildingDeviceService.command() after MQTT publish + DB persist.
   */
  sendSocket(buildingId: number, id: string, attributes: any) {
    const room = `/building/${buildingId}`;
    this.server.to(room).emit('device:attribute-update', {
      id,
      buildingId,
      attributes,
      timestamp: new Date().toISOString(),
    });

    // Also broadcast globally for building-level listeners
    this.server.emit(`/building/attribute/${buildingId}`, {
      id,
      attributes,
    });
  }

  /**
   * Broadcast device attribute update to clients viewing a specific floor.
   */
  sendAttributeDevice(buildingId: number, floorId: number, deviceId: string, attributes: any) {
    const room = `/building/${buildingId}/floor/${floorId}`;
    this.server.to(room).emit('data::attribute', {
      id: deviceId,
      attributes,
      timestamp: new Date().toISOString(),
    });
  }
}

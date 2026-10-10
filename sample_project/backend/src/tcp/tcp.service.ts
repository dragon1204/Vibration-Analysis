import { Injectable, Logger } from '@nestjs/common';
import { ServerTCP } from '@nestjs/microservices';

import * as crypto from 'crypto';
import { Socket } from 'net';

@Injectable()
export class CustomTcpServer extends ServerTCP {
  protected readonly logger = new Logger(CustomTcpServer.name);
  private lastCheck: boolean = false;
  // Override the `listen` method to intercept socket connections
  public listen(callback: () => void) {
    this.server.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
    super.listen(callback);
  }

  // Handle new connections
  private handleConnection(socket: Socket) {
    this.logger.log('New client connected');
    let socketClosed = false;
    // Set a timeout for cases where no data is sent
    const timeout = setTimeout(() => {
      this.logger.warn(
        'Client connected but sent no data. Closing connection.',
      );
      socket.write(
        JSON.stringify({ ret: -1037, message: 'Device not authroized' }) + '\n',
      );
      socketClosed = true;
      socket.end(); // Close the connection after timeout
    }, 5000); // 5 seconds timeout

    // Listen for incoming data
    socket.on('data', (buffer) => {
      if (socketClosed) return;
      clearTimeout(timeout);
      const message = buffer.toString();
      this.logger.log(`Received data: ${message}`);
      // // Check SN in db
      // // Return { "ret":-1037, "message": "Device not authroized"} if not found
      // // Check sign
      // // Return // Return { "ret":-1037, "message": "Device not authroized"} if not match
      // const parsedMessage = JSON.parse(message);
      // const SN = parsedMessage.SN;
      // const timestamp = parsedMessage.timestamp;
      // console.log('SN:', SN, 'Timestamp:', timestamp);
      // // const key = 'your16bytekeyhere';
      // // const sign = this.generateSign(SN, timestamp, key);
      // // console.log('Sign:', sign);
      // // if (SN != 4284513892) {
      // //   this.logger.warn('SN not found in database');
      // //   socket.write(
      // //     JSON.stringify({ ret: -1037, message: 'Device not authroized' }) +
      // //       '\n',
      // //   );
      // // }

      // try {
      //   const response = {
      //     ret: 0,
      //     message: 'OK',
      //     data: {
      //       commType: 'MQTT',
      //       mqttAddr: '103.124.95.246',
      //       mqttPort: 1884,
      //       mqttAccount: 'yootek',
      //       mqttPwd: '123qwe',
      //       clientID: `${SN}`,
      //       subscribeTopic: `/thinmoo/${SN}/command`,
      //       dataPublishTopic: `/thinmoo/${SN}/data`,
      //       rtDataPublishTopic: `/thinmoo/${SN}/dataRT`,
      //     },
      //   };
      //   socket.write(JSON.stringify(response) + '\n');
      // } catch (error) {
      //   this.logger.error(`Error processing data: ${error.message}`);
      //   socket.write(
      //     JSON.stringify({ ret: -1037, message: 'Device not authroized' }) +
      //       '\n',
      //   );
      // }
    });

    // Handle client disconnection
    socket.on('end', () => {
      this.logger.log('Client disconnected');
    });

    // Handle errors
    socket.on('error', (error) => {
      this.logger.error(`Socket error: ${error.message}`);
    });
  }

  generateSign(SN: string, timestamp: number, key: string): string {
    // Multiply the timestamp by 1000 and convert to string
    const timeInMs = (timestamp * 1000).toString();
    // Concatenate SN and timestamp
    const stringToEncrypt = SN + timeInMs;
    // const iv = Buffer.alloc(16, 0); // Initialization vector (16 bytes of 0)
    // const cipher = crypto.createCipheriv(
    //   'aes-128-ecb',
    //   Buffer.from(key, 'utf8'),
    //   iv,
    // );
    // let encrypted = cipher.update(stringToEncrypt, 'utf8', 'hex');
    // encrypted += cipher.final('hex');
    // Generate the MD5 hash in lowercase
    const hash = crypto
      .createHash('md5')
      .update(stringToEncrypt)
      .digest('hex')
      .toLowerCase();
    return hash;
  }
}

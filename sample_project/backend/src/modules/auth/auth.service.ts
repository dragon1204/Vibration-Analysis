import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@src/prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import type { TAuthConfig } from '@configs/auth.config';

@Injectable()
export class AuthService {
  private readonly accessTokenExpireIn: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    const authConfig = this.configService.get<TAuthConfig>('auth');
    this.accessTokenExpireIn = authConfig?.accessTokenExpireIn || 86400;
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        fullName: dto.fullName,
      },
    });

    delete (user as any).password;
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      expireInSeconds: this.accessTokenExpireIn,
      tenantId: null,
    };
  }

  /**
   * Refresh an access token.
   * Verifies the old token (ignoring expiration), looks up the user,
   * and issues a fresh access token.
   */
  async refreshToken(oldToken: string) {
    try {
      // Decode and verify the token — allow expired tokens so we can refresh them
      const decoded = this.jwtService.verify(oldToken, { ignoreExpiration: true });

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decoded.sub)) {
        throw new UnauthorizedException('Token không hợp lệ, vui lòng đăng nhập lại');
      }

      // Ensure user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User không tồn tại');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };

      return {
        accessToken: await this.jwtService.signAsync(payload),
        expireInSeconds: this.accessTokenExpireIn,
      };
    } catch (error) {
      throw new UnauthorizedException('Token không hợp lệ, vui lòng đăng nhập lại');
    }
  }

  /**
   * Logout — currently stateless JWT so just acknowledge.
   * If you add a token blacklist (Redis) later, invalidate the token here.
   */
  async logout(): Promise<{ success: boolean }> {
    return { success: true };
  }

  async getMe(userId: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return null;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user) {
        delete (user as any).password;
      }
      return user;
    } catch (error) {
      return null;
    }
  }
}

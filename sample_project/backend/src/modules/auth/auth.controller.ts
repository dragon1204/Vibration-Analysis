import { Controller, Post, Body, Get, Req, UseGuards, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      data: result,
      error: null,
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      data: result,
      error: null,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  async getMe(@Req() req: any) {
    const result = await this.authService.getMe(req.user.userId);
    return {
      success: true,
      data: result,
      error: null,
    };
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh an expired access token' })
  async refreshToken(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return { success: false, data: null, error: 'Token is required' };
    }
    const result = await this.authService.refreshToken(token);
    return {
      success: true,
      data: result,
      error: null,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: 'Logout current user' })
  async logout() {
    const result = await this.authService.logout();
    return {
      success: true,
      data: result,
      error: null,
    };
  }
}

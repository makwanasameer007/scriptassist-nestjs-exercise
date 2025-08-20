import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role
    };

    const { accessToken, refreshToken } = await this.issueTokens(user.id, payload);
    await this.usersService.setHashedRefreshToken(user.id, refreshToken);
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new UnauthorizedException('Email already exists');
    }

    const user = await this.usersService.create(registerDto);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = await this.issueTokens(user.id, payload);
    await this.usersService.setHashedRefreshToken(user.id, refreshToken);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async issueTokens(userId: string, basePayload: any) {
    const accessToken = this.jwtService.sign(basePayload);
    // Rotating opaque refresh token stored hashed server-side
    const refreshToken = randomBytes(48).toString('base64url');
    return { accessToken, refreshToken };
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.usersService.findOne(userId);
    
    if (!user) {
      return null;
    }
    
    return user;
  }

  async validateUserRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    return true;
  }

  async rotateRefreshToken(userId: string, providedToken: string) {
    const valid = await this.usersService.isRefreshTokenValid(userId, providedToken);
    if (!valid) {
      throw new ForbiddenException('Invalid refresh token');
    }
    const user = await this.usersService.findOne(userId);
    const payload = { sub: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = await this.issueTokens(user.id, payload);
    await this.usersService.setHashedRefreshToken(user.id, refreshToken);
    return { access_token: accessToken, refresh_token: refreshToken };
  }
} 
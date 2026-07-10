import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request";
import { createDtoValidationPipe } from "../../common/validation/validation-error";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterParentDto } from "./dto/register-parent.dto";
import { RegisterStudentDto } from "./dto/register-student.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register/student")
  @ApiOperation({ summary: "Register a student account" })
  registerStudent(
    @Body(createDtoValidationPipe(RegisterStudentDto)) dto: RegisterStudentDto,
  ) {
    return this.authService.registerStudent(dto);
  }

  @Post("register/parent")
  @ApiOperation({ summary: "Register a parent account" })
  registerParent(
    @Body(createDtoValidationPipe(RegisterParentDto)) dto: RegisterParentDto,
  ) {
    return this.authService.registerParent(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login by username, email or phone number" })
  login(@Body(createDtoValidationPipe(LoginDto)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh token and issue a new access token" })
  refresh(@Body(createDtoValidationPipe(RefreshTokenDto)) dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a refresh token" })
  logout(@Body(createDtoValidationPipe(RefreshTokenDto)) dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request a password reset token" })
  forgotPassword(
    @Body(createDtoValidationPipe(ForgotPasswordDto)) dto: ForgotPasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.forgotPassword(dto, {
      ipAddress: request.ip,
      userAgent: request.get?.("user-agent"),
    });
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password by reset token" })
  resetPassword(@Body(createDtoValidationPipe(ResetPasswordDto)) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}

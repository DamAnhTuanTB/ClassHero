import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterParentDto } from "./dto/register-parent.dto";
import { RegisterStudentDto } from "./dto/register-student.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register/student")
  @ApiOperation({ summary: "Register a student account" })
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @Post("register/parent")
  @ApiOperation({ summary: "Register a parent account" })
  registerParent(@Body() dto: RegisterParentDto) {
    return this.authService.registerParent(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login by username, email or phone number" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate a refresh token and issue a new access token" })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a refresh token" })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto);
  }
}

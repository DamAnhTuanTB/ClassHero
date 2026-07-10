import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthService } from "#api/modules/auth/services/auth.service";
import { UpdateStudentProfileDto } from "#api/modules/auth/dto/update-student-profile.dto";

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ProfileController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user and profile" })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Patch("me/student-profile")
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: "Update allowed student profile fields" })
  updateStudentProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.authService.updateStudentProfile(user.id, dto);
  }
}

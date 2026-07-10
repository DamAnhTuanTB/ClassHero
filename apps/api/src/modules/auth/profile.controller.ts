import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { createDtoValidationPipe } from "../../common/validation/validation-error";
import { AuthService } from "./auth.service";
import { UpdateStudentProfileDto } from "./dto/update-student-profile.dto";

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
    @Body(createDtoValidationPipe(UpdateStudentProfileDto))
    dto: UpdateStudentProfileDto,
  ) {
    return this.authService.updateStudentProfile(user.id, dto);
  }
}

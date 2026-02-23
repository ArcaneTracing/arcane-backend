import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SetupResponseDto } from "../dto/response/setup-response.dto";
import { BetterAuthUserService } from "../services/better-auth-user.service";

@Controller("setup")
@ApiTags("setup")
@AllowAnonymous()
export class SetupController {
  constructor(private readonly userService: BetterAuthUserService) {}

  @Get()
  @ApiOperation({
    summary: "Setup status",
    description:
      "Returns whether initial setup is required (no users exist yet).",
  })
  @ApiResponse({
    status: 200,
    description: "Setup status returned",
    type: SetupResponseDto,
  })
  async getSetupStatus(): Promise<SetupResponseDto> {
    const hasUsers = await this.userService.hasAnyUsers();
    return { shouldSetup: !hasUsers };
  }
}

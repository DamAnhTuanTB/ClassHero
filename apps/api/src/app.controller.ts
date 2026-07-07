import { Controller, Get, Inject } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return this.appService.getRoot();
  }

  @Get("api/v1/health")
  getHealth() {
    return this.appService.getHealth();
  }
}

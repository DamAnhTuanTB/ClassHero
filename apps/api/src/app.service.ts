import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getRoot() {
    return {
      data: {
        name: "learning-path-api",
        status: "ready",
      },
      meta: {},
    };
  }
}

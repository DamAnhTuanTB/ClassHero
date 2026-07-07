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

  getHealth() {
    return {
      data: {
        name: "learning-path-api",
        status: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}

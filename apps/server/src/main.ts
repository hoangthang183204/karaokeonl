import "./load-env";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { KaraokeRoom } from "./colyseus/karaoke.room";

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    throw new Error("JWT_SECRET phải có ít nhất 16 ký tự.");
  }

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  const origins = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((item) => item.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();

  const httpServer = createServer(expressApp);
  const gameServer = new Server({ server: httpServer });
  gameServer.define("karaoke", KaraokeRoom).filterBy(["roomCode"]);

  const port = Number(process.env.PORT ?? 3001);
  await new Promise<void>((resolveListen) => httpServer.listen(port, "0.0.0.0", resolveListen));
  console.log(`KARAOKE API + Colyseus đang nghe cổng ${port}`);
}

void bootstrap();

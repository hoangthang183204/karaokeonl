import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "object" && body && "code" in body) {
        response.status(status).json(body);
        return;
      }
      const raw = typeof body === "string" ? body : (body as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join(", ") : raw || "Yêu cầu không hợp lệ.";
      response.status(status).json({
        code: status === HttpStatus.UNAUTHORIZED ? "unauthenticated" : "invalid_request",
        message,
      });
      return;
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "server_error",
      message: "Lỗi máy chủ.",
    });
  }
}

import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Phải chạy trước khi Nest đọc JWT_SECRET lúc khai báo module.

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });


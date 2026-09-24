import { copyFile } from "node:fs/promises";
import { constants } from "node:fs";
try {
  await copyFile(".env.example", ".env", constants.COPYFILE_EXCL);
  console.log(
    "已创建 .env。运行 npm run build 和 npm start 后，在网页左下角「设置 → 模型与接口」填写 API Key 即可。",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".env 已存在，保留原配置。");
}

import { z } from "zod";
const schema = z.object({
  test: z.number({ message: "Vui lòng nhập số hợp lệ" })
});

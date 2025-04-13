import Elysia from "elysia";
import { chat } from "./chat";

export const aiAPI = new Elysia()
  .use(chat);

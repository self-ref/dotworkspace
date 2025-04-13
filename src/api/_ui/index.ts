import Elysia from "elysia";
import { html } from "@elysiajs/html";
import uiHTML from "./ui.html" with { type: 'text' };

export const ui = new Elysia()
  .use(html())
  .get('/', () => uiHTML);

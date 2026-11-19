import { criarServidor } from "./app.ts";

const porta = Number(process.env.PORT ?? 3001);

criarServidor().listen(porta, () => {
  console.log(`BFF ouvindo em http://localhost:${porta}`);
});

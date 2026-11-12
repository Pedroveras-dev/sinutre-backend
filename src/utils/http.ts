import { NextFunction, Request, RequestHandler, Response } from 'express';

// Erro com status HTTP. Lançar `new HttpError(400, '...')` dentro de uma rota
// faz o middleware de erro responder com esse status e essa mensagem.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// O Express 4 não captura promessas rejeitadas: sem este wrapper, qualquer
// erro dentro de uma rota `async` vira "unhandled rejection" e derruba o
// processo. Aqui a rejeição é encaminhada ao `next`, que chama o errorHandler.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

// Middleware final: transforma erros em respostas JSON.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // JSON malformado no corpo da requisição (erro do express.json()).
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido.' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}

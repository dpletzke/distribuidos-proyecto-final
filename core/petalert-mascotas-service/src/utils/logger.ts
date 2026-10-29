export const logger = {
  info: (mensaje: string) => console.log(JSON.stringify({ nivel: 'info', mensaje })),
  error: (mensaje: string) => console.error(JSON.stringify({ nivel: 'error', mensaje }))
};

import app from './app';
import { db } from './db';

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => process.stdout.write(`API listening on ${port}\n`));

const shutdown = () => {
  server.close(() => { void db.$disconnect().then(() => process.exit(0)); });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

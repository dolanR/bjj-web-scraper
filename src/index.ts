import cors from '@elysiajs/cors';
import swagger from '@elysiajs/swagger';
import Elysia from 'elysia';
import router from './routes/router';

const app = new Elysia().use(swagger()).use(cors()).use(router).listen(8080);

console.log(`🦊 Elysia is running at on port ${app.server?.port}...`);

import Elysia from 'elysia';
import test from './test';

const router = new Elysia()
	.get('/', () => {
		return 'Hello world!';
	})
	.use(test);

export default router;

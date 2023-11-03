import { Elysia, t } from 'elysia';

export const testModel = new Elysia().model({
	schema: t.Object(
		{
			name: t.String({
				error: 'Error: Name (string) is required',
			}),
			age: t.Optional(t.Number()),
		},
		{}
	),
});

const test = new Elysia({ prefix: '/test' })
	.use(testModel)
	.post(
		'/',
		({ body }) => {
			return `Valid! name: ${body.name}, age: ${body.age}`;
		},
		{
			body: 'schema',
			detail: {
				description: 'Test post',
			},
		}
	)
	.get('/', () => {
		return '/test GET response';
	});

export default test;

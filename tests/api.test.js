import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import {
  api,
  clearDatabase,
  closeTestDatabase,
  getCollection,
  makeUser,
  seedRecipe,
  seedUser,
  tokenFor
} from './support/test-app.js';

const validRecipePayload = (overrides = {}) => ({
  recipeName: 'Test Lentil Soup',
  recipeImage: 'https://example.test/lentil-soup.jpg',
  category: 'Dinner',
  cuisineType: 'South Asian',
  recipeType: 'South Asian',
  difficultyLevel: 'Easy',
  preparationTime: 35,
  ingredients: ['lentils', 'water'],
  importantTopics: ['lentils', 'water'],
  instructions: Array(55).fill('Cook the ingredients carefully').join(' '),
  isPremium: false,
  ...overrides
});

beforeEach(async () => {
  await clearDatabase();
});

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(async () => {
  await closeTestDatabase();
  jest.restoreAllMocks();
});

describe('health and recipes', () => {
  test('rejects non-local database URIs before test-mode connection', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', "import('./db.js').then(() => process.exit(2)).catch(error => process.exit(error.message.includes('exact MongoMemoryServer URI') ? 0 : 3))"],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MONGO_DB_URI: 'mongodb+srv://production.invalid/recipehub',
          RECIPEHUB_TEST_MONGO_URI: process.env.RECIPEHUB_TEST_MONGO_URI,
          DB_NAME: 'production'
        }
      }
    );

    expect(result.status).toBe(0);
  });

  test('rejects a different localhost URI with the expected test database name', () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', "import('./db.js').then(() => process.exit(2)).catch(error => process.exit(error.message.includes('exact MongoMemoryServer URI') ? 0 : 3))"],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MONGO_DB_URI: 'mongodb://127.0.0.1:27017/',
          DB_NAME: `recipehub_test_${process.pid}`
        }
      }
    );

    expect(result.status).toBe(0);
  });

  test('reports a healthy API and connected test database', async () => {
    const response = await api.get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: true });
  });

  test('retrieves a public recipe without exposing locked instructions', async () => {
    const recipe = await seedRecipe();
    const response = await api.get(`/api/recipes/${recipe._id}`).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.recipeName).toBe(recipe.recipeName);
    expect(response.body.data.isLocked).toBe(true);
    expect(response.body.data).not.toHaveProperty('instructions');
  });

  test('requires authentication and validates recipe creation input', async () => {
    const recipePayload = validRecipePayload();
    await api.post('/api/recipes').send(recipePayload).expect(401);

    const user = makeUser();
    await seedUser(user);
    const token = tokenFor(user);

    const missingFields = await api.post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipeName: 'Incomplete' })
      .expect(400);
    expect(missingFields.body.success).toBe(false);

    const shortInstructions = await api.post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send(validRecipePayload({ instructions: 'Not enough words.' }))
      .expect(400);
    expect(shortInstructions.body.message).toMatch(/at least 50 words/i);
  });

  test('creates a valid recipe for an authenticated user', async () => {
    const user = makeUser();
    await seedUser(user);

    const response = await api.post('/api/recipes')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send(validRecipePayload())
      .expect(201);

    expect(response.body.success).toBe(true);
    const recipe = await getCollection('recipes').findOne({ authorEmail: user.email });
    expect(recipe.authorEmail).toBe(user.email);
    expect(recipe.likesCount).toBe(0);
  });

  test('does not allow recipe edits to replace review data', async () => {
    const author = makeUser();
    const reviewer = makeUser();
    await seedUser(author);
    const recipe = await seedRecipe({
      authorId: author.id,
      authorEmail: author.email,
      reviews: [{ userId: reviewer.id, userName: reviewer.name, rating: 4, comment: 'Keep this review' }]
    });

    await api.put(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenFor(author)}`)
      .send({ recipeName: 'Renamed Recipe', reviews: [] })
      .expect(200);

    const updated = await getCollection('recipes').findOne({ _id: recipe._id });
    expect(updated.recipeName).toBe('Renamed Recipe');
    expect(updated.reviews).toHaveLength(1);
    expect(updated.reviews[0].comment).toBe('Keep this review');
  });
});

describe('ratings and reviews', () => {
  test('lists reviews publicly with average/count and no reviewer identifiers', async () => {
    const recipe = await seedRecipe({
      reviews: [
        { userId: 'private-user-id', userEmail: 'private@example.test', userName: 'Reviewer One', rating: 4, comment: 'Tasty', createdAt: new Date(), updatedAt: new Date() },
        { userId: 'another-private-id', userName: 'Reviewer Two', rating: 2, comment: 'Needs salt', createdAt: new Date(), updatedAt: new Date() }
      ]
    });

    const response = await api.get(`/api/recipes/${recipe._id}/reviews`).expect(200);
    expect(response.body.averageRating).toBe(3);
    expect(response.body.reviewCount).toBe(2);
    expect(response.body.reviews.map(review => review.userName)).toEqual(['Reviewer One', 'Reviewer Two']);
    expect(response.body.reviews[0]).not.toHaveProperty('userId');
    expect(response.body.reviews[0]).not.toHaveProperty('userEmail');
  });

  test('requires authentication and validates rating and comment input', async () => {
    const user = makeUser();
    await seedUser(user);
    const recipe = await seedRecipe();
    const route = `/api/recipes/${recipe._id}/reviews`;
    const token = tokenFor(user);

    await api.put(route).send({ rating: 5, comment: 'Good recipe' }).expect(401);
    await api.put(route).set('Authorization', `Bearer ${token}`).send({ rating: 0, comment: 'Good recipe' }).expect(400);
    await api.put(route).set('Authorization', `Bearer ${token}`).send({ rating: 6, comment: 'Good recipe' }).expect(400);
    await api.put(route).set('Authorization', `Bearer ${token}`).send({ rating: 4, comment: '   ' }).expect(400);
    await api.put(route).set('Authorization', `Bearer ${token}`).send({ rating: 4, comment: 'x'.repeat(1001) }).expect(400);

    expect(await getCollection('recipes').findOne({ _id: recipe._id })).not.toHaveProperty('reviews');
  });

  test('creates and edits one review per user, accepting JWT bearer and cookie auth', async () => {
    const user = makeUser();
    await seedUser(user);
    const recipe = await seedRecipe();
    const route = `/api/recipes/${recipe._id}/reviews`;
    const token = tokenFor(user);

    await api.put(route)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'A very good recipe' })
      .expect(200);

    await api.put(route)
      .set('Cookie', `token=${token}`)
      .send({ rating: 3, comment: 'Updated after making it again' })
      .expect(200);

    const storedRecipe = await getCollection('recipes').findOne({ _id: recipe._id });
    expect(storedRecipe.reviews).toHaveLength(1);
    expect(storedRecipe.reviews[0]).toMatchObject({
      userId: user.id,
      rating: 3,
      comment: 'Updated after making it again'
    });

    const publicResponse = await api.get(route).expect(200);
    expect(publicResponse.body.averageRating).toBe(3);
    expect(publicResponse.body.reviewCount).toBe(1);
    expect(publicResponse.body.reviews[0].isOwnReview).toBe(false);

    const authenticatedResponse = await api.get(route)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(authenticatedResponse.body.reviews[0].isOwnReview).toBe(true);
    expect(authenticatedResponse.body.reviews[0]).not.toHaveProperty('userId');
  });
});

describe('likes, favorites and reports', () => {
  test('requires authentication and increments a recipe like', async () => {
    const user = makeUser();
    await seedUser(user);
    const recipe = await seedRecipe();
    const route = `/api/recipes/${recipe._id}/like`;

    await api.post(route).expect(401);
    await api.post(route).set('Authorization', `Bearer ${tokenFor(user)}`).expect(200);
    expect((await getCollection('recipes').findOne({ _id: recipe._id })).likesCount).toBe(1);
  });

  test('adds, lists, rejects duplicate and removes a favorite', async () => {
    const user = makeUser();
    await seedUser(user);
    const recipe = await seedRecipe();
    const token = tokenFor(user);

    await api.post('/api/favorites').send({ recipeId: recipe._id.toString() }).expect(401);
    const add = () => api.post('/api/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipeId: recipe._id.toString() });
    await add().expect(201);
    await add().expect(400);

    const list = await api.get('/api/favorites').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].recipeName).toBe(recipe.recipeName);

    await api.delete(`/api/favorites/${recipe._id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(await getCollection('favorites').countDocuments({ userId: user.id })).toBe(0);
  });

  test('validates protected reports and records a valid report', async () => {
    const user = makeUser();
    await seedUser(user);
    const recipe = await seedRecipe();
    const route = `/api/recipes/${recipe._id}/report`;
    const token = tokenFor(user);

    await api.post(route).send({ reason: 'Spam' }).expect(401);
    await api.post(route).set('Authorization', `Bearer ${token}`).send({ reason: 'Other' }).expect(400);
    await api.post(route).set('Authorization', `Bearer ${token}`).send({ reason: 'Spam' }).expect(200);
    expect(await getCollection('reports').countDocuments({ recipeId: recipe._id, reporterEmail: user.email })).toBe(1);
  });
});

describe('admin and payments', () => {
  test('protects admin statistics from unauthenticated and non-admin users', async () => {
    const user = makeUser();
    const admin = makeUser({ role: 'admin' });
    await seedUser(user);
    await seedUser(admin);

    await api.get('/api/admin/stats').expect(401);
    await api.get('/api/admin/stats').set('Authorization', `Bearer ${tokenFor(user)}`).expect(403);
    const response = await api.get('/api/admin/stats')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .expect(200);
    expect(response.body.success).toBe(true);
  });

  test('allows admins to feature recipes and denies ordinary users', async () => {
    const user = makeUser();
    const admin = makeUser({ role: 'admin' });
    await seedUser(user);
    await seedUser(admin);
    const recipe = await seedRecipe();
    const route = `/api/admin/recipes/${recipe._id}/feature`;

    await api.put(route).send({ isFeatured: true }).expect(401);
    await api.put(route).set('Authorization', `Bearer ${tokenFor(user)}`).send({ isFeatured: true }).expect(403);
    await api.put(route).set('Authorization', `Bearer ${tokenFor(admin)}`).send({ isFeatured: true }).expect(200);
    expect((await getCollection('recipes').findOne({ _id: recipe._id })).isFeatured).toBe(true);
  });

  test('validates checkout requests without contacting Stripe', async () => {
    const user = makeUser();
    await seedUser(user);
    const response = await api.post('/api/create-checkout-session')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ type: 'unsupported' })
      .expect(400);

    expect(response.body.message).toMatch(/purchase type/i);
    expect(await getCollection('payments').countDocuments()).toBe(0);
  });
});

import { randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';

const mongoServer = await MongoMemoryServer.create();

process.env.NODE_ENV = 'test';
const testMongoUri = mongoServer.getUri();
process.env.RECIPEHUB_TEST_MONGO_URI = testMongoUri;
process.env.MONGO_DB_URI = testMongoUri;
process.env.DB_NAME = `recipehub_test_${process.pid}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'recipehub-test.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'synthetic-test-only-secret';
process.env.STRIPE_SECRET_KEY = `sk_test_${randomBytes(24).toString('hex')}`;

let app;
let mongoClient;
let getCollectionFromDb;
let getDatabase;
let connectDatabase;

try {
  ({ default: app } = await import('../../app.js'));
  ({
    getCollection: getCollectionFromDb,
    getDb: getDatabase,
    connectDB: connectDatabase,
    client: mongoClient
  } = await import('../../db.js'));
  await connectDatabase();
} catch (error) {
  await mongoServer.stop();
  throw error;
}

export const api = request(app);
export const getCollection = (...args) => getCollectionFromDb(...args);

export function makeUser(overrides = {}) {
  return {
    id: new ObjectId().toString(),
    email: `${randomUUID()}@example.test`,
    name: 'Synthetic Test User',
    role: 'user',
    isPremium: false,
    ...overrides
  };
}

export function tokenFor(user) {
  return jwt.sign({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isPremium: user.isPremium
  }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

export async function seedUser(user) {
  await getCollection('users').insertOne({
    _id: new ObjectId(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    isPremium: user.isPremium,
    isBlocked: false
  });
}

export async function seedRecipe(overrides = {}) {
  const recipe = {
    recipeName: 'Synthetic Test Recipe',
    recipeImage: 'https://example.test/recipe.jpg',
    category: 'Dinner',
    cuisineType: 'Test',
    recipeType: 'Test',
    difficultyLevel: 'Easy',
    preparationTime: 30,
    ingredients: ['rice'],
    importantTopics: ['rice'],
    instructions: Array(55).fill('Cook carefully').join(' '),
    isPremium: false,
    authorId: new ObjectId().toString(),
    authorName: 'Synthetic Author',
    authorEmail: 'author@example.test',
    likesCount: 0,
    isFeatured: false,
    status: 'published',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
  const result = await getCollection('recipes').insertOne(recipe);
  return { ...recipe, _id: result.insertedId };
}

export async function clearDatabase() {
  const collections = await getDatabase().listCollections().toArray();
  await Promise.all(collections.map(({ name }) => getCollection(name).deleteMany({})));
}

export async function closeTestDatabase() {
  await mongoClient.close();
  await mongoServer.stop();
}

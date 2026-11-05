import app from './app.js';
import { connectDB } from './db.js';

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(error => {
  console.error("Database connection failed. Server not started.", error);
  process.exit(1);
});
const { MongoClient } = require('mongodb');

class MongoConnection {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    if (!this.client) {
      this.client = new MongoClient(process.env.MONGODB_URL, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db('globaltaxcalc');

      console.log('Connected to MongoDB');
    }

    return this.db;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  async getCollection(name) {
    const db = await this.connect();
    return db.collection(name);
  }
}

module.exports = new MongoConnection();